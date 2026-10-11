import { pool } from '../db';
import { getMessage, isGmailConfigured, listMessageIds } from './gmailClient';
import { getShopifyConfig, syncOrders, type ShopifyOrder } from './shopifyClient';

// Marcadores que imprime la plantilla de notificación al staff
// (docs/shopify/staff-order-notification.liquid). Entre ellos va el pedido en
// base64 (preferido: inmune al HTML del correo) o en JSON plano.
const PAYLOAD_RE = /BEASTHUB_ORDER_JSON_START([\s\S]*?)BEASTHUB_ORDER_JSON_END/;

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Extrae el pedido del cuerpo del correo; null si no trae el bloque o no es válido. */
export function extractOrderPayload(body: string): ShopifyOrder | null {
  const match = body.match(PAYLOAD_RE);
  if (!match) return null;
  let raw = decodeEntities(match[1]).trim();
  if (!raw.startsWith('{')) {
    raw = Buffer.from(raw.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  // Los IDs de Shopify pueden superar 2^53: leerlos como texto para no perder dígitos.
  raw = raw.replace(/"(id|variant_id)"\s*:\s*(\d+)/g, '"$1":"$2"');
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || !data.id || !data.name || !Array.isArray(data.line_items)) return null;
  // "Enviar notificación de prueba" de Shopify usa siempre este pedido ficticio.
  if (data.name === '#9999' && data.customer?.email === 'john@example.com') return null;

  // Liquid entrega textos con entidades HTML (p. ej. títulos con &quot;).
  const str = (v: unknown): string | null =>
    v === null || v === undefined || String(v).trim() === '' ? null : decodeEntities(String(v)).trim();
  const addr = (a: any) =>
    a
      ? {
          name: str(a.name),
          phone: str(a.phone),
          address1: str(a.address1),
          address2: str(a.address2),
          city: str(a.city),
        }
      : null;

  return {
    id: String(data.id),
    name: String(data.name),
    financial_status: str(data.financial_status) ?? 'pending',
    fulfillment_status: str(data.fulfillment_status),
    payment_gateway: str(data.payment_gateway) ?? '',
    total_price: String(data.total_price ?? '0'),
    shipping_lines: [{ price: String(data.shipping_price ?? '0') }],
    customer: data.customer
      ? {
          first_name: str(data.customer.first_name),
          last_name: str(data.customer.last_name),
          phone: str(data.customer.phone),
          email: str(data.customer.email),
        }
      : null,
    billing_address: addr(data.billing_address),
    shipping_address: addr(data.shipping_address),
    line_items: data.line_items.map((li: any) => ({
      variant_id: li.variant_id ? String(li.variant_id) : null,
      title: str(li.title) ?? '',
      quantity: Number(li.quantity) || 1,
      price: String(li.price ?? '0'),
      sku: str(li.sku) ?? '',
    })),
    created_at: str(data.created_at) ?? new Date().toISOString(),
  };
}

export interface EmailIngestResult {
  ran: boolean;
  reason?: string;
  scanned: number;
  imported: number;
  skipped: number;
  no_payload: number;
  errors: string[];
  unmatched_items: number;
  unmatched_samples: string[];
}

type LogStatus = 'imported' | 'skipped' | 'error' | 'no_payload';

async function logMessage(
  messageId: string,
  status: LogStatus,
  extra: { orderId?: string | null; orderName?: string | null; error?: string | null; receivedAt?: string | null }
): Promise<void> {
  await pool.query(
    `INSERT INTO shopify_email_ingest
       (gmail_message_id, shopify_order_id, order_name, status, error, received_at, processed_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (gmail_message_id) DO UPDATE
       SET shopify_order_id = EXCLUDED.shopify_order_id,
           order_name = EXCLUDED.order_name,
           status = EXCLUDED.status,
           error = EXCLUDED.error,
           processed_at = now()`,
    [
      messageId,
      extra.orderId ?? null,
      extra.orderName ?? null,
      status,
      extra.error ?? null,
      extra.receivedAt ?? null,
    ]
  );
}

// Clave arbitraria del advisory lock: evita dos corridas simultáneas
// (intervalo + botón "Revisar ahora", o más de una réplica).
const LOCK_KEY = 728_028;

/**
 * Lee de Gmail las notificaciones "Nuevo pedido" y las importa con syncOrders.
 * `force` corre aunque el switch esté apagado (botón manual).
 */
export async function runEmailIngest(force = false): Promise<EmailIngestResult> {
  const result: EmailIngestResult = {
    ran: false,
    scanned: 0,
    imported: 0,
    skipped: 0,
    no_payload: 0,
    errors: [],
    unmatched_items: 0,
    unmatched_samples: [],
  };

  if (!isGmailConfigured()) return { ...result, reason: 'Gmail no configurado en el servidor' };
  const cfg = await getShopifyConfig();
  if (!cfg) return { ...result, reason: 'Shopify no configurado' };
  if (!force && !cfg.email_ingest_enabled) return { ...result, reason: 'Importación automática desactivada' };

  const lockClient = await pool.connect();
  try {
    const { rows } = await lockClient.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
    if (!rows[0]?.ok) return { ...result, reason: 'Ya hay una importación en curso' };
    try {
      result.ran = true;
      const ids = await listMessageIds(cfg.email_ingest_query);
      // Los mensajes con error se reintentan; el resto ya quedó procesado.
      const { rows: seen } = await pool.query<{ gmail_message_id: string }>(
        `SELECT gmail_message_id FROM shopify_email_ingest
          WHERE gmail_message_id = ANY($1::text[]) AND status <> 'error'`,
        [ids]
      );
      const seenSet = new Set(seen.map((r) => r.gmail_message_id));
      const pending = ids.filter((id) => !seenSet.has(id));
      result.scanned = pending.length;

      // Del más viejo al más nuevo para que los pedidos entren en orden.
      for (const id of pending.reverse()) {
        let receivedAt: string | null = null;
        try {
          const msg = await getMessage(id);
          receivedAt = msg.receivedAt;
          const order = msg.bodies.map(extractOrderPayload).find(Boolean) ?? null;
          if (!order) {
            result.no_payload++;
            await logMessage(id, 'no_payload', { receivedAt, orderName: msg.subject });
            continue;
          }
          const r = await syncOrders([order]);
          result.unmatched_items += r.unmatched_items;
          for (const s of r.unmatched_samples) {
            if (result.unmatched_samples.length < 10) result.unmatched_samples.push(s);
          }
          const base = { orderId: String(order.id), orderName: order.name, receivedAt };
          if (r.errors.length > 0) {
            result.errors.push(...r.errors);
            await logMessage(id, 'error', { ...base, error: r.errors.join('; ') });
          } else if (r.imported > 0) {
            result.imported++;
            await logMessage(id, 'imported', base);
          } else {
            result.skipped++;
            await logMessage(id, 'skipped', base);
          }
        } catch (err: any) {
          const message = err?.message ?? 'error desconocido';
          result.errors.push(`${id}: ${message}`);
          await logMessage(id, 'error', { error: message, receivedAt });
        }
      }

      await pool.query(
        'UPDATE shopify_config SET last_email_ingest = now(), last_email_ingest_error = $1 WHERE id = 1',
        [result.errors.length ? result.errors.slice(0, 3).join('; ') : null]
      );
    } catch (err: any) {
      await pool.query(
        'UPDATE shopify_config SET last_email_ingest = now(), last_email_ingest_error = $1 WHERE id = 1',
        [err?.message ?? 'error desconocido']
      );
      throw err;
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    lockClient.release();
  }
  return result;
}

export function emailIngestPollMinutes(): number {
  const n = Number(process.env.GMAIL_POLL_MINUTES);
  return Number.isFinite(n) && n >= 1 ? n : 5;
}

/** Arranca el sondeo periódico. No-op si faltan las credenciales de Gmail. */
export function startEmailIngestScheduler(): void {
  if (!isGmailConfigured()) {
    console.log('[email-ingest] Gmail no configurado; sondeo desactivado');
    return;
  }
  const minutes = emailIngestPollMinutes();
  const tick = () => {
    runEmailIngest()
      .then((r) => {
        if (r.ran && (r.imported || r.errors.length || r.no_payload)) {
          console.log(
            `[email-ingest] importados=${r.imported} omitidos=${r.skipped} sin_bloque=${r.no_payload} errores=${r.errors.length}`
          );
        }
      })
      .catch((err) => console.error('[email-ingest] falló:', err?.message ?? err));
  };
  setInterval(tick, minutes * 60_000);
  setTimeout(tick, 30_000); // primera corrida poco después del arranque
  console.log(`[email-ingest] sondeo cada ${minutes} min`);
}
