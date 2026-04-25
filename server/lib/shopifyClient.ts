import { pool } from '../db';

// ---------------------------------------------------------------------------
// Types (minimal — only what we need from the Shopify API)
// ---------------------------------------------------------------------------

export interface ShopifyConfig {
  store_domain: string;
  access_token: string;
  sync_enabled: boolean;
  last_products_sync: string | null;
  last_orders_sync: string | null;
  location_id: string | null;
  location_name: string | null;
  last_inventory_sync: string | null;
  inventory_sync_enabled: boolean;
}

interface ShopifyVariant {
  // Nullable: CSV exports don't include real Variant IDs.
  id: number | string | null;
  sku: string;
  price: string;
  inventory_quantity: number;
  inventory_item_id: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  cost?: number | null;
}

interface ShopifyProduct {
  // Nullable: CSV exports don't include real Product IDs.
  id: number | string | null;
  title: string;
  handle: string;
  options: Array<{ name: string; position: number }>;
  variants: ShopifyVariant[];
}

interface ShopifyLineItem {
  variant_id: number | null;
  title: string;
  quantity: number;
  price: string;
  sku: string;
}

interface ShopifyCustomer {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

interface ShopifyOrder {
  id: number | string;
  name: string; // e.g. "#1001"
  financial_status: string;
  fulfillment_status: string | null;
  payment_gateway: string;
  total_price: string;
  shipping_lines: Array<{ price: string }>;
  customer: ShopifyCustomer | null;
  billing_address: { phone: string | null; name: string | null } | null;
  line_items: ShopifyLineItem[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export async function getShopifyConfig(): Promise<ShopifyConfig | null> {
  const { rows } = await pool.query('SELECT * FROM shopify_config WHERE id = 1');
  return rows[0] ?? null;
}

function requireConfig(cfg: ShopifyConfig | null): ShopifyConfig {
  if (!cfg || !cfg.store_domain || !cfg.access_token) {
    throw Object.assign(new Error('Shopify no configurado. Guarda las credenciales primero.'), {
      status: 400,
    });
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const SHOPIFY_API_VERSION = '2024-01';

interface ShopifyFetchResult<T> {
  body: T;
  nextPageInfo: string | null;
}

async function shopifyFetch<T>(
  cfg: ShopifyConfig,
  path: string,
  params: Record<string, string> = {}
): Promise<ShopifyFetchResult<T>> {
  const qs = new URLSearchParams(params).toString();
  const url = `https://${cfg.store_domain}/admin/api/${SHOPIFY_API_VERSION}/${path}${qs ? '?' + qs : ''}`;

  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': cfg.access_token,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) {
    throw Object.assign(new Error('Credenciales de Shopify inválidas (401).'), { status: 400 });
  }
  if (res.status === 429) {
    throw Object.assign(new Error('Rate limit de Shopify alcanzado. Intenta de nuevo en unos segundos.'), {
      status: 429,
    });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Shopify API error ${res.status}: ${res.statusText}`), {
      status: 502,
    });
  }

  // Parse Link header for cursor-based pagination (rel="next")
  const link = res.headers.get('link') ?? '';
  const nextMatch = link.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
  const nextPageInfo = nextMatch ? decodeURIComponent(nextMatch[1]) : null;

  const body = (await res.json()) as T;
  return { body, nextPageInfo };
}

async function shopifyMutate<T>(
  cfg: ShopifyConfig,
  method: 'POST' | 'PUT',
  path: string,
  payload: unknown
): Promise<T> {
  const url = `https://${cfg.store_domain}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'X-Shopify-Access-Token': cfg.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    throw Object.assign(new Error('Credenciales de Shopify inválidas (401).'), { status: 400 });
  }
  if (res.status === 429) {
    throw Object.assign(new Error('Rate limit de Shopify alcanzado.'), { status: 429 });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Shopify API error ${res.status}: ${res.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`),
      { status: 502 }
    );
  }
  return (await res.json()) as T;
}

/** Paginate through a Shopify list endpoint using Link-header cursors. */
async function shopifyPaginateAll<T>(
  cfg: ShopifyConfig,
  resource: string,
  rootKey: string
): Promise<T[]> {
  const results: T[] = [];
  let pageInfo: string | null = null;
  const MAX_PAGES = 40; // safety cap — 10k items

  for (let i = 0; i < MAX_PAGES; i++) {
    // Shopify disallows combining page_info with other filters, so limit
    // is only set on the first request.
    const params: Record<string, string> = pageInfo
      ? { limit: '250', page_info: pageInfo }
      : { limit: '250', status: 'any' };

    const { body, nextPageInfo } = await shopifyFetch<Record<string, T[]>>(
      cfg,
      `${resource}.json`,
      params
    );

    const page = body[rootKey] ?? [];
    results.push(...page);

    if (!nextPageInfo) break;
    pageInfo = nextPageInfo;

    // Gentle throttle to respect 2 req/s rate limit on Basic plan
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Product mapping
// ---------------------------------------------------------------------------

interface MappedVariant {
  shopify_variant_id: string | null;
  shopify_inventory_item_id: string | null;
  sku: string;
  sku_synthesized: boolean;
  price: number;
  cost: number;
  stock: number;
  base_color: string | null;
  size: string | null;
  name: string;
}

interface MappedProduct {
  shopify_product_id: string | null;
  parent_sku: string;
  name: string;
  variants: MappedVariant[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapShopifyProduct(product: ShopifyProduct): MappedProduct {
  const colorOptionIndex = product.options.findIndex((o) =>
    /color|colour/i.test(o.name)
  );
  const sizeOptionIndex = product.options.findIndex((o) =>
    /size|talla|taille/i.test(o.name)
  );

  const variants: MappedVariant[] = [];

  for (const v of product.variants) {
    const optionValues = [v.option1, v.option2, v.option3];
    const base_color = colorOptionIndex >= 0 ? (optionValues[colorOptionIndex] ?? null) : null;
    const size = sizeOptionIndex >= 0 ? (optionValues[sizeOptionIndex] ?? null) : (v.option1 ?? null);

    const rawSku = v.sku?.trim() ?? '';
    const sku_synthesized = !rawSku;
    const sku = rawSku || slugify(
      `${product.handle}-${[v.option1, v.option2, v.option3].filter(Boolean).join('-')}`
    );

    if (!sku) continue; // last-resort guard: no handle and no options → impossible to identify

    variants.push({
      shopify_variant_id: v.id != null ? String(v.id) : null,
      shopify_inventory_item_id: v.inventory_item_id ? String(v.inventory_item_id) : null,
      sku,
      sku_synthesized,
      price: parseFloat(v.price) || 0,
      cost: v.cost != null ? Number(v.cost) || 0 : 0,
      stock: v.inventory_quantity ?? 0,
      base_color,
      size,
      name: `${product.title} – ${[v.option1, v.option2, v.option3].filter(Boolean).join(' / ')}`,
    });
  }

  const shopify_product_id = product.id != null ? String(product.id) : null;
  const parent_sku = shopify_product_id
    ? `PARENT-${shopify_product_id}`
    : `PARENT-csv-${product.handle}`;

  return {
    shopify_product_id,
    parent_sku,
    name: product.title,
    variants,
  };
}

// ---------------------------------------------------------------------------
// Order mapping
// ---------------------------------------------------------------------------

const COD_GATEWAYS = new Set(['cash_on_delivery', 'cod', 'manual', 'contra_entrega', 'contraentrega']);

function mapFulfillmentStatus(status: string | null): string {
  if (status === 'fulfilled') return 'shipped';
  if (status === 'partial') return 'processing';
  return 'pending';
}

function buildOrderNumber(shopifyName: string, attempt = 0): string {
  const base = 'SHO-' + shopifyName.replace('#', '').padStart(4, '0');
  return attempt === 0 ? base : `${base}-${String.fromCharCode(65 + attempt - 1)}`;
}

export interface MappedOrder {
  shopify_order_id: string;
  shopify_order_number: string;
  order_number: string;
  source: 'shopify';
  customer_name: string;
  customer_phone: string;
  status: string;
  is_cod: boolean;
  shipping_cost: number;
  items: Array<{
    shopify_variant_id: string | null;
    sku: string;
    title: string;
    quantity: number;
    unit_price: number;
  }>;
}

export function mapShopifyOrder(order: ShopifyOrder): MappedOrder {
  const c = order.customer;
  const firstName = c?.first_name ?? '';
  const lastName = c?.last_name ?? '';
  const customer_name = [firstName, lastName].filter(Boolean).join(' ') || 'Cliente Shopify';
  const customer_phone =
    c?.phone || order.billing_address?.phone || 'N/A';

  return {
    shopify_order_id: String(order.id),
    shopify_order_number: order.name,
    order_number: buildOrderNumber(order.name),
    source: 'shopify',
    customer_name,
    customer_phone,
    status: mapFulfillmentStatus(order.fulfillment_status),
    is_cod: COD_GATEWAYS.has((order.payment_gateway ?? '').toLowerCase()),
    shipping_cost: parseFloat(order.shipping_lines?.[0]?.price ?? '0') || 0,
    items: order.line_items.map((li) => ({
      shopify_variant_id: li.variant_id ? String(li.variant_id) : null,
      sku: li.sku ?? '',
      title: li.title ?? '',
      quantity: li.quantity,
      unit_price: parseFloat(li.price) || 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV parsers (Shopify standard export format)
// ---------------------------------------------------------------------------

// RFC 4180 compliant: parses the entire text in one pass so that newlines
// inside quoted fields (e.g. HTML descriptions) don't break row boundaries.
function parseCsv(text: string): Array<Record<string, string>> {
  const stripped = text.replace(/^﻿/, ''); // strip UTF-8 BOM
  const rows: string[][] = [];
  let fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '"') {
      if (inQuotes && stripped[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && stripped[i + 1] === '\n') i++;
      fields.push(current);
      if (fields.some((f) => f.length > 0)) rows.push(fields);
      fields = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || fields.length > 0) {
    fields.push(current);
    if (fields.some((f) => f.length > 0)) rows.push(fields);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (row[i] ?? '').trim()));
    return obj;
  });
}

export function parseShopifyProductsCsv(csvText: string): ShopifyProduct[] {
  const rows = parseCsv(csvText);
  const productMap = new Map<string, ShopifyProduct>();

  for (const row of rows) {
    const handle = row['Handle'];
    if (!handle) continue;

    let product = productMap.get(handle);

    // Option names only appear on the first (parent) row of a product.
    // Capture them whenever they are present so subsequent variant rows
    // don't downgrade a real name to a placeholder.
    const opt1Name = row['Option1 Name'] || '';
    const opt2Name = row['Option2 Name'] || '';

    if (!product) {
      product = {
        id: null, // CSV does not include real Shopify Product IDs
        title: row['Title'] || handle,
        handle,
        options: [
          { name: opt1Name || 'Option1', position: 1 },
          { name: opt2Name || 'Option2', position: 2 },
        ],
        variants: [],
      };
      productMap.set(handle, product);
    } else {
      // Backfill option names if a later row carries them.
      if (opt1Name && product.options[0].name === 'Option1') product.options[0].name = opt1Name;
      if (opt2Name && product.options[1].name === 'Option2') product.options[1].name = opt2Name;
      if (row['Title']) product.title = row['Title'];
    }

    const sku = row['Variant SKU'] || '';
    const price = row['Variant Price'] || '';
    const opt1 = row['Option1 Value'] || '';
    const opt2 = row['Option2 Value'] || '';
    const opt3 = row['Option3 Value'] || '';

    // Skip image-only continuation rows (no variant data at all).
    if (!sku && !price && !opt1 && !opt2 && !opt3) continue;

    const costRaw = row['Cost per item'] || '';
    const cost = costRaw ? parseFloat(costRaw) || 0 : 0;

    product.variants.push({
      id: null, // CSV does not include real Shopify Variant IDs
      sku, // may be empty — mapShopifyProduct synthesizes if so
      price: price || '0',
      inventory_quantity: parseInt(row['Variant Inventory Qty'] || '0', 10),
      inventory_item_id: null, // CSV does not include this; only API path populates it
      option1: opt1 || null,
      option2: opt2 || null,
      option3: opt3 || null,
      cost,
    });
  }

  return Array.from(productMap.values());
}

export function parseShopifyOrdersCsv(csvText: string): ShopifyOrder[] {
  const rows = parseCsv(csvText);
  const orderMap = new Map<string, ShopifyOrder>();

  for (const row of rows) {
    const name = row['Name'];
    if (!name) continue;

    if (!orderMap.has(name)) {
      const billingName = row['Billing Name'] || '';
      const [firstName = '', ...rest] = billingName.split(' ');
      // Use the real Shopify order ID from the "Id" column (idempotency on
      // re-imports). Fall back to the order name only as a last resort.
      const realId = row['Id'] || '';
      const billingPhone = row['Billing Phone'] || '';
      const shippingPhone = row['Shipping Phone'] || '';
      orderMap.set(name, {
        id: realId || `csv-${name}`,
        name,
        financial_status: row['Financial Status'] || 'pending',
        fulfillment_status: row['Fulfillment Status'] || null,
        payment_gateway: row['Payment Method'] || '',
        total_price: row['Total'] || '0',
        shipping_lines: [{ price: row['Shipping'] || '0' }],
        customer: {
          first_name: firstName || null,
          last_name: rest.join(' ') || null,
          // Shopify CSV often leaves the trailing "Phone" column empty and
          // puts the actual number in "Billing Phone" / "Shipping Phone".
          phone: row['Phone'] || billingPhone || shippingPhone || null,
          email: row['Email'] || null,
        },
        billing_address: billingPhone
          ? { phone: billingPhone, name: billingName || null }
          : null,
        line_items: [],
        created_at: row['Created at'] || new Date().toISOString(),
      });
    }

    const order = orderMap.get(name)!;
    const itemName = row['Lineitem name'];
    if (itemName) {
      order.line_items.push({
        variant_id: null, // CSV doesn't include variant_id; we'll match by SKU
        title: itemName,
        quantity: parseInt(row['Lineitem quantity'] || '1', 10),
        price: row['Lineitem price'] || '0',
        sku: row['Lineitem sku'] || '',
      });
    }
  }

  return Array.from(orderMap.values());
}

// ---------------------------------------------------------------------------
// Sync: Products → Beast Hub upsert
// ---------------------------------------------------------------------------

export interface SyncProductsResult {
  upserted: number;
  skipped: number;
  synthesized_skus: number;
  errors: string[];
}

export async function syncProducts(shopifyProducts: ShopifyProduct[]): Promise<SyncProductsResult> {
  const result: SyncProductsResult = { upserted: 0, skipped: 0, synthesized_skus: 0, errors: [] };

  for (const raw of shopifyProducts) {
    const mapped = mapShopifyProduct(raw);
    if (mapped.variants.length === 0) {
      result.skipped++;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find existing parent: by shopify_product_id (if known) then by deterministic SKU.
      // Avoids ON CONFLICT — there is no UNIQUE constraint on shopify_product_id and
      // CSV imports may legitimately have it NULL.
      let parentId: string | null = null;
      if (mapped.shopify_product_id) {
        const r = await client.query(
          `SELECT id FROM products
             WHERE shopify_product_id = $1 AND is_parent = true
             LIMIT 1`,
          [mapped.shopify_product_id]
        );
        parentId = r.rows[0]?.id ?? null;
      }
      if (!parentId) {
        const r = await client.query(
          `SELECT id FROM products WHERE sku = $1 LIMIT 1`,
          [mapped.parent_sku]
        );
        parentId = r.rows[0]?.id ?? null;
      }

      if (parentId) {
        // Update parent name; only set shopify_product_id if not already set
        // (so re-importing a CSV doesn't wipe a real ID written by API sync).
        await client.query(
          `UPDATE products
             SET name = $1,
                 shopify_product_id = COALESCE(shopify_product_id, $2),
                 updated_at = now()
           WHERE id = $3`,
          [mapped.name, mapped.shopify_product_id, parentId]
        );
      } else {
        const r = await client.query(
          `INSERT INTO products (sku, name, is_parent, shopify_product_id, active)
           VALUES ($1, $2, true, $3, true)
           RETURNING id`,
          [mapped.parent_sku, mapped.name, mapped.shopify_product_id]
        );
        parentId = r.rows[0].id;
      }

      if (!parentId) {
        result.errors.push(`No se pudo crear parent para: ${mapped.name}`);
        await client.query('ROLLBACK');
        continue;
      }

      // Upsert each variant: try by shopify_variant_id first (if not null), then by sku, then insert.
      // COALESCE on Shopify-only fields ensures CSV imports never overwrite real IDs from API path.
      for (const v of mapped.variants) {
        if (v.sku_synthesized) result.synthesized_skus++;

        let existingId: string | null = null;
        if (v.shopify_variant_id) {
          const r = await client.query(
            `SELECT id FROM products WHERE shopify_variant_id = $1 LIMIT 1`,
            [v.shopify_variant_id]
          );
          existingId = r.rows[0]?.id ?? null;
        }
        if (!existingId) {
          const r = await client.query(
            `SELECT id FROM products WHERE sku = $1 AND is_parent = false LIMIT 1`,
            [v.sku]
          );
          existingId = r.rows[0]?.id ?? null;
        }

        if (existingId) {
          await client.query(
            `UPDATE products
               SET sku = $1,
                   name = $2,
                   price = $3,
                   stock = $4,
                   base_color = $5,
                   size = $6,
                   parent_id = $7,
                   shopify_variant_id = COALESCE(shopify_variant_id, $8),
                   shopify_inventory_item_id = COALESCE(shopify_inventory_item_id, $9),
                   cost = CASE WHEN $10::numeric > 0 THEN $10::numeric ELSE cost END,
                   updated_at = now()
             WHERE id = $11`,
            [v.sku, v.name, v.price, v.stock, v.base_color, v.size, parentId,
             v.shopify_variant_id, v.shopify_inventory_item_id, v.cost, existingId]
          );
        } else {
          await client.query(
            `INSERT INTO products
               (sku, name, is_parent, parent_id, shopify_variant_id, shopify_inventory_item_id,
                price, cost, stock, base_color, size, active)
             VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
            [v.sku, v.name, parentId, v.shopify_variant_id, v.shopify_inventory_item_id,
             v.price, v.cost, v.stock, v.base_color, v.size]
          );
        }
        result.upserted++;
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      result.errors.push(`${mapped.name}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sync: Orders → Beast Hub upsert
// ---------------------------------------------------------------------------

export interface SyncOrdersResult {
  imported: number;
  skipped: number;
  unmatched_items: number;
  unmatched_samples: string[];
  errors: string[];
}

export async function syncOrders(shopifyOrders: ShopifyOrder[]): Promise<SyncOrdersResult> {
  const result: SyncOrdersResult = {
    imported: 0,
    skipped: 0,
    unmatched_items: 0,
    unmatched_samples: [],
    errors: [],
  };

  for (const raw of shopifyOrders) {
    const mapped = mapShopifyOrder(raw);

    // Skip if already imported
    const { rows: existing } = await pool.query(
      'SELECT id FROM orders WHERE shopify_order_id = $1',
      [mapped.shopify_order_id]
    );
    if (existing.length > 0) {
      result.skipped++;
      continue;
    }

    // Find a unique order_number (handle collisions with SHO-XXXX-A, -B, ...)
    let orderNumber = mapped.order_number;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { rows: collision } = await pool.query(
        'SELECT id FROM orders WHERE order_number = $1',
        [orderNumber]
      );
      if (collision.length === 0) break;
      orderNumber = buildOrderNumber(raw.name, attempt);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderRes = await client.query(
        `INSERT INTO orders
           (order_number, source, customer_name, customer_phone, status,
            is_cod, shipping_cost, shopify_order_id, shopify_order_number)
         VALUES ($1, 'shopify', $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          orderNumber,
          mapped.customer_name,
          mapped.customer_phone,
          mapped.status,
          mapped.is_cod,
          mapped.shipping_cost,
          mapped.shopify_order_id,
          mapped.shopify_order_number,
        ]
      );
      const orderId = orderRes.rows[0].id;
      const decrementedProductIds: string[] = [];

      for (const item of mapped.items) {
        // Resolve product_id: first by shopify_variant_id, then by SKU
        let productId: string | null = null;
        if (item.shopify_variant_id) {
          const pr = await client.query(
            'SELECT id FROM products WHERE shopify_variant_id = $1',
            [item.shopify_variant_id]
          );
          productId = pr.rows[0]?.id ?? null;
        }
        if (!productId && item.sku) {
          const pr = await client.query('SELECT id FROM products WHERE sku = $1', [item.sku]);
          productId = pr.rows[0]?.id ?? null;
        }

        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [orderId, productId, item.quantity, item.unit_price]
        );

        // BH-dominant: Shopify already decremented its own stock when the order
        // was placed. Mirror that in BH so the next push doesn't overwrite it.
        if (productId) {
          await client.query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [item.quantity, productId]
          );
          decrementedProductIds.push(productId);
        } else {
          // CSV exports often ship empty Lineitem SKU — record so the user can act.
          result.unmatched_items++;
          if (result.unmatched_samples.length < 10) {
            const ref = item.sku ? `sku=${item.sku}` : `nombre="${item.title}"`;
            result.unmatched_samples.push(`${mapped.shopify_order_number}: ${ref}`);
          }
        }
      }

      await client.query('COMMIT');
      result.imported++;

      // Push to Shopify (idempotent — set.json with the post-decrement value).
      // If our decrement matches Shopify's, this is a no-op there.
      for (const pid of decrementedProductIds) {
        await tryPushInventoryAfterCommit(pid);
      }
    } catch (err: any) {
      await client.query('ROLLBACK');
      result.errors.push(`${mapped.shopify_order_number}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return result;
}

// Lazy import to avoid a circular dependency: inventorySync imports from this file.
async function tryPushInventoryAfterCommit(productId: string): Promise<void> {
  const { tryPushInventory } = await import('./inventorySync');
  await tryPushInventory(productId);
}

// ---------------------------------------------------------------------------
// Public sync functions (fetch from Shopify API + upsert)
// ---------------------------------------------------------------------------

export async function syncProductsFromShopify(): Promise<SyncProductsResult> {
  const cfg = requireConfig(await getShopifyConfig());
  const products = await shopifyPaginateAll<ShopifyProduct>(cfg, 'products', 'products');
  const result = await syncProducts(products);
  await pool.query('UPDATE shopify_config SET last_products_sync = now() WHERE id = 1');
  return result;
}

export async function syncOrdersFromShopify(): Promise<SyncOrdersResult> {
  const cfg = requireConfig(await getShopifyConfig());
  const orders = await shopifyPaginateAll<ShopifyOrder>(cfg, 'orders', 'orders');
  const result = await syncOrders(orders);
  await pool.query('UPDATE shopify_config SET last_orders_sync = now() WHERE id = 1');
  return result;
}

export interface TestConnectionResult {
  shop: string;
  products_count: number | null;
  orders_count: number | null;
  locations_count: number | null;
  products_error: string | null;
  orders_error: string | null;
  locations_error: string | null;
}

async function safeCount(cfg: ShopifyConfig, resource: 'products' | 'orders'): Promise<{ count: number | null; error: string | null }> {
  const params: Record<string, string> = resource === 'orders' ? { status: 'any' } : {};
  try {
    const { body } = await shopifyFetch<{ count: number }>(cfg, `${resource}/count.json`, params);
    return { count: body.count ?? 0, error: null };
  } catch (err: any) {
    return { count: null, error: err.message ?? 'error desconocido' };
  }
}

async function safeLocationsCount(cfg: ShopifyConfig): Promise<{ count: number | null; error: string | null }> {
  try {
    const { body } = await shopifyFetch<{ locations: unknown[] }>(cfg, 'locations.json');
    return { count: body.locations?.length ?? 0, error: null };
  } catch (err: any) {
    return { count: null, error: err.message ?? 'error desconocido' };
  }
}

export async function testShopifyConnection(): Promise<TestConnectionResult> {
  const cfg = requireConfig(await getShopifyConfig());
  const { body } = await shopifyFetch<{ shop: { name: string } }>(cfg, 'shop.json');
  const [products, orders, locations] = await Promise.all([
    safeCount(cfg, 'products'),
    safeCount(cfg, 'orders'),
    safeLocationsCount(cfg),
  ]);
  return {
    shop: body.shop.name,
    products_count: products.count,
    orders_count: orders.count,
    locations_count: locations.count,
    products_error: products.error,
    orders_error: orders.error,
    locations_error: locations.error,
  };
}

// ---------------------------------------------------------------------------
// Inventory: locations, pull, push (BH-dominant bidirectional sync)
// ---------------------------------------------------------------------------

export interface ShopifyLocation {
  id: string;
  name: string;
  active: boolean;
}

export async function listShopifyLocations(): Promise<ShopifyLocation[]> {
  const cfg = requireConfig(await getShopifyConfig());
  const { body } = await shopifyFetch<{ locations: Array<{ id: number; name: string; active: boolean }> }>(
    cfg,
    'locations.json'
  );
  return body.locations.map((l) => ({ id: String(l.id), name: l.name, active: l.active }));
}

export interface InventoryPullResult {
  updated: number;
  unmatched: number;
  errors: string[];
}

/** Pull inventory levels from Shopify into BH for the configured location. */
export async function pullInventoryFromShopify(): Promise<InventoryPullResult> {
  const cfg = requireConfig(await getShopifyConfig());
  if (!cfg.location_id) {
    throw Object.assign(new Error('Selecciona una location en la configuración primero.'), { status: 400 });
  }

  const result: InventoryPullResult = { updated: 0, unmatched: 0, errors: [] };

  // Paginate inventory_levels.json filtered by location.
  let pageInfo: string | null = null;
  const MAX_PAGES = 80; // 80 * 250 = 20k items
  for (let i = 0; i < MAX_PAGES; i++) {
    const params: Record<string, string> = pageInfo
      ? { limit: '250', page_info: pageInfo }
      : { limit: '250', location_ids: cfg.location_id };
    const { body, nextPageInfo } = await shopifyFetch<{
      inventory_levels: Array<{ inventory_item_id: number; available: number | null }>;
    }>(cfg, 'inventory_levels.json', params);

    for (const lvl of body.inventory_levels ?? []) {
      const itemId = String(lvl.inventory_item_id);
      const available = lvl.available ?? 0;
      const upd = await pool.query(
        'UPDATE products SET stock = $1, updated_at = now() WHERE shopify_inventory_item_id = $2',
        [available, itemId]
      );
      if (upd.rowCount && upd.rowCount > 0) result.updated++;
      else result.unmatched++;
    }

    if (!nextPageInfo) break;
    pageInfo = nextPageInfo;
    await new Promise((r) => setTimeout(r, 500));
  }

  await pool.query('UPDATE shopify_config SET last_inventory_sync = now() WHERE id = 1');
  return result;
}

export interface PushInventoryResult {
  ok: boolean;
  error: string | null;
  skipped_reason: 'no_inventory_item' | 'no_location' | 'sync_disabled' | null;
}

/** Push a single product's stock to Shopify. Logs errors to shopify_sync_errors on failure. */
export async function pushInventoryToShopify(productId: string): Promise<PushInventoryResult> {
  const cfg = await getShopifyConfig();
  if (!cfg || !cfg.store_domain || !cfg.access_token) {
    return { ok: false, error: null, skipped_reason: 'sync_disabled' };
  }
  if (!cfg.location_id) {
    return { ok: false, error: null, skipped_reason: 'no_location' };
  }

  const { rows } = await pool.query(
    'SELECT shopify_inventory_item_id, stock FROM products WHERE id = $1',
    [productId]
  );
  const product = rows[0];
  if (!product?.shopify_inventory_item_id) {
    return { ok: false, error: null, skipped_reason: 'no_inventory_item' };
  }

  try {
    await shopifyMutate(cfg, 'POST', 'inventory_levels/set.json', {
      location_id: Number(cfg.location_id),
      inventory_item_id: Number(product.shopify_inventory_item_id),
      available: Number(product.stock),
    });
    // Resolve any prior errors for this product.
    await pool.query(
      `UPDATE shopify_sync_errors SET resolved_at = now()
       WHERE product_id = $1 AND resolved_at IS NULL`,
      [productId]
    );
    return { ok: true, error: null, skipped_reason: null };
  } catch (err: any) {
    const message = err.message ?? String(err);
    await pool.query(
      `INSERT INTO shopify_sync_errors (product_id, operation, error_message)
       VALUES ($1, 'push_inventory', $2)`,
      [productId, message]
    );
    return { ok: false, error: message, skipped_reason: null };
  }
}

export interface PushBulkResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/** Re-push all products with unresolved errors. */
export async function pushPendingInventoryErrors(): Promise<PushBulkResult> {
  const { rows } = await pool.query<{ product_id: string }>(
    `SELECT DISTINCT product_id FROM shopify_sync_errors
     WHERE resolved_at IS NULL AND product_id IS NOT NULL`
  );
  const result: PushBulkResult = { attempted: rows.length, succeeded: 0, failed: 0 };
  for (const r of rows) {
    const pushed = await pushInventoryToShopify(r.product_id);
    if (pushed.ok) result.succeeded++;
    else result.failed++;
    await new Promise((p) => setTimeout(p, 500));
  }
  return result;
}

export interface InventoryError {
  id: string;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  operation: string;
  error_message: string;
  attempted_at: string;
}

export async function listInventoryErrors(): Promise<InventoryError[]> {
  const { rows } = await pool.query<InventoryError>(
    `SELECT e.id, e.product_id, p.name AS product_name, p.sku AS product_sku,
            e.operation, e.error_message, e.attempted_at
       FROM shopify_sync_errors e
       LEFT JOIN products p ON p.id = e.product_id
       WHERE e.resolved_at IS NULL
       ORDER BY e.attempted_at DESC
       LIMIT 200`
  );
  return rows;
}
