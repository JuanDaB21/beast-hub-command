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
}

interface ShopifyVariant {
  id: number;
  sku: string;
  price: string;
  inventory_quantity: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface ShopifyProduct {
  id: number;
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
  id: number;
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
  shopify_variant_id: string;
  sku: string;
  price: number;
  stock: number;
  base_color: string | null;
  size: string | null;
  name: string;
}

interface MappedProduct {
  shopify_product_id: string;
  name: string;
  variants: MappedVariant[];
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
    if (!v.sku?.trim()) continue; // skip variants without SKU

    const optionValues = [v.option1, v.option2, v.option3];
    const base_color = colorOptionIndex >= 0 ? (optionValues[colorOptionIndex] ?? null) : null;
    const size = sizeOptionIndex >= 0 ? (optionValues[sizeOptionIndex] ?? null) : (v.option1 ?? null);

    variants.push({
      shopify_variant_id: String(v.id),
      sku: v.sku.trim(),
      price: parseFloat(v.price) || 0,
      stock: v.inventory_quantity ?? 0,
      base_color,
      size,
      name: `${product.title} – ${[v.option1, v.option2, v.option3].filter(Boolean).join(' / ')}`,
    });
  }

  return {
    shopify_product_id: String(product.id),
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
      quantity: li.quantity,
      unit_price: parseFloat(li.price) || 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV parsers (Shopify standard export format)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const stripped = text.replace(/^﻿/, ''); // strip BOM
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (values[i] ?? '').trim()));
    return row;
  });
}

export function parseShopifyProductsCsv(csvText: string): ShopifyProduct[] {
  const rows = parseCsv(csvText);
  const productMap = new Map<string, ShopifyProduct>();
  let variantIdCounter = Date.now();

  for (const row of rows) {
    const handle = row['Handle'];
    if (!handle) continue;

    if (!productMap.has(handle)) {
      productMap.set(handle, {
        id: variantIdCounter++,
        title: row['Title'] || handle,
        handle,
        options: [
          { name: row['Option1 Name'] || 'Option1', position: 1 },
          { name: row['Option2 Name'] || 'Option2', position: 2 },
        ],
        variants: [],
      });
    }

    const product = productMap.get(handle)!;
    const sku = row['Variant SKU'];
    if (!sku) continue;

    product.variants.push({
      id: variantIdCounter++,
      sku,
      price: row['Variant Price'] || '0',
      inventory_quantity: parseInt(row['Variant Inventory Qty'] || '0', 10),
      option1: row['Option1 Value'] || null,
      option2: row['Option2 Value'] || null,
      option3: row['Option3 Value'] || null,
    });
  }

  return Array.from(productMap.values());
}

export function parseShopifyOrdersCsv(csvText: string): ShopifyOrder[] {
  const rows = parseCsv(csvText);
  const orderMap = new Map<string, ShopifyOrder>();
  let idCounter = Date.now();

  for (const row of rows) {
    const name = row['Name'];
    if (!name) continue;

    if (!orderMap.has(name)) {
      const billingName = row['Billing Name'] || '';
      const [firstName = '', ...rest] = billingName.split(' ');
      orderMap.set(name, {
        id: idCounter++,
        name,
        financial_status: row['Financial Status'] || 'pending',
        fulfillment_status: row['Fulfillment Status'] || null,
        payment_gateway: row['Payment Method'] || '',
        total_price: row['Total'] || '0',
        shipping_lines: [{ price: row['Shipping'] || '0' }],
        customer: {
          first_name: firstName || null,
          last_name: rest.join(' ') || null,
          phone: row['Phone'] || null,
          email: row['Email'] || null,
        },
        billing_address: null,
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
  errors: string[];
}

export async function syncProducts(shopifyProducts: ShopifyProduct[]): Promise<SyncProductsResult> {
  const result: SyncProductsResult = { upserted: 0, skipped: 0, errors: [] };

  for (const raw of shopifyProducts) {
    const mapped = mapShopifyProduct(raw);
    if (mapped.variants.length === 0) {
      result.skipped++;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert parent product
      const parentRes = await client.query(
        `INSERT INTO products
           (sku, name, is_parent, shopify_product_id, active)
         VALUES ($1, $2, true, $3, true)
         ON CONFLICT (shopify_product_id)
           DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id`,
        [`PARENT-${mapped.shopify_product_id}`, mapped.name, mapped.shopify_product_id]
      );

      // Handle case where parent was previously created without shopify_product_id
      let parentId: string;
      if (parentRes.rows[0]) {
        parentId = parentRes.rows[0].id;
      } else {
        // Fallback: find parent by sku
        const existing = await client.query(
          `SELECT id FROM products WHERE sku = $1`,
          [`PARENT-${mapped.shopify_product_id}`]
        );
        parentId = existing.rows[0]?.id;
        if (parentId) {
          await client.query(
            `UPDATE products SET shopify_product_id = $1, name = $2, updated_at = now() WHERE id = $3`,
            [mapped.shopify_product_id, mapped.name, parentId]
          );
        }
      }

      if (!parentId) {
        result.errors.push(`No se pudo crear parent para: ${mapped.name}`);
        await client.query('ROLLBACK');
        continue;
      }

      // Upsert each variant: try by shopify_variant_id first, then by sku, then insert
      for (const v of mapped.variants) {
        // 1. Try to match by shopify_variant_id
        const byVariantId = await client.query(
          `UPDATE products
             SET sku=$1, name=$2, price=$3, stock=$4, base_color=$5, size=$6,
                 parent_id=$7, updated_at=now()
           WHERE shopify_variant_id=$8
           RETURNING id`,
          [v.sku, v.name, v.price, v.stock, v.base_color, v.size, parentId, v.shopify_variant_id]
        );
        if (byVariantId.rowCount && byVariantId.rowCount > 0) {
          result.upserted++;
          continue;
        }

        // 2. Try to match by sku (backfill shopify_variant_id)
        const bySku = await client.query(
          `UPDATE products
             SET shopify_variant_id=$1, name=$2, price=$3, stock=$4,
                 base_color=$5, size=$6, parent_id=$7, updated_at=now()
           WHERE sku=$8 AND is_parent=false
           RETURNING id`,
          [v.shopify_variant_id, v.name, v.price, v.stock, v.base_color, v.size, parentId, v.sku]
        );
        if (bySku.rowCount && bySku.rowCount > 0) {
          result.upserted++;
          continue;
        }

        // 3. Insert new variant
        await client.query(
          `INSERT INTO products
             (sku, name, is_parent, parent_id, shopify_variant_id, price, stock, base_color, size, active)
           VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8, true)`,
          [v.sku, v.name, parentId, v.shopify_variant_id, v.price, v.stock, v.base_color, v.size]
        );
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
  errors: string[];
}

export async function syncOrders(shopifyOrders: ShopifyOrder[]): Promise<SyncOrdersResult> {
  const result: SyncOrdersResult = { imported: 0, skipped: 0, errors: [] };

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
      }

      await client.query('COMMIT');
      result.imported++;
    } catch (err: any) {
      await client.query('ROLLBACK');
      result.errors.push(`${mapped.shopify_order_number}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return result;
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

export async function testShopifyConnection(): Promise<{ shop: string }> {
  const cfg = requireConfig(await getShopifyConfig());
  const { body } = await shopifyFetch<{ shop: { name: string } }>(cfg, 'shop.json');
  return { shop: body.shop.name };
}
