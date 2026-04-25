import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';
import {
  getShopifyConfig,
  testShopifyConnection,
  syncProductsFromShopify,
  syncOrdersFromShopify,
  parseShopifyProductsCsv,
  parseShopifyOrdersCsv,
  syncProducts,
  syncOrders,
  listShopifyLocations,
  pullInventoryFromShopify,
  pushPendingInventoryErrors,
  listInventoryErrors,
} from '../lib/shopifyClient';

export const shopifyRouter = Router();

/** GET / — return current config (access_token masked). */
shopifyRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const cfg = await getShopifyConfig();
    if (!cfg) {
      return res.json({
        store_domain: '',
        access_token: '',
        sync_enabled: false,
        location_id: null,
        location_name: null,
        last_inventory_sync: null,
        inventory_sync_enabled: false,
      });
    }
    const masked =
      cfg.access_token.length > 4
        ? '****' + cfg.access_token.slice(-4)
        : cfg.access_token ? '****' : '';
    res.json({
      store_domain: cfg.store_domain,
      access_token: masked,
      sync_enabled: cfg.sync_enabled,
      last_products_sync: cfg.last_products_sync,
      last_orders_sync: cfg.last_orders_sync,
      location_id: cfg.location_id,
      location_name: cfg.location_name,
      last_inventory_sync: cfg.last_inventory_sync,
      inventory_sync_enabled: cfg.inventory_sync_enabled,
    });
  })
);

/** POST /config — save Shopify credentials. */
shopifyRouter.post(
  '/config',
  asyncHandler(async (req, res) => {
    const {
      store_domain,
      access_token,
      sync_enabled,
      location_id,
      location_name,
      inventory_sync_enabled,
    } = req.body as {
      store_domain?: string;
      access_token?: string;
      sync_enabled?: boolean;
      location_id?: string | null;
      location_name?: string | null;
      inventory_sync_enabled?: boolean;
    };

    if (!store_domain?.trim()) {
      return res.status(400).json({ error: 'store_domain requerido' });
    }

    // Normalize domain
    const domain = store_domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

    const updates: string[] = ['store_domain = $1', 'updated_at = now()'];
    const params: unknown[] = [domain];

    if (access_token !== undefined && access_token.trim() && !access_token.startsWith('****')) {
      params.push(access_token.trim());
      updates.push(`access_token = $${params.length}`);
    }
    if (sync_enabled !== undefined) {
      params.push(sync_enabled);
      updates.push(`sync_enabled = $${params.length}`);
    }
    if (location_id !== undefined) {
      params.push(location_id);
      updates.push(`location_id = $${params.length}`);
    }
    if (location_name !== undefined) {
      params.push(location_name);
      updates.push(`location_name = $${params.length}`);
    }
    if (inventory_sync_enabled !== undefined) {
      params.push(inventory_sync_enabled);
      updates.push(`inventory_sync_enabled = $${params.length}`);
    }

    await pool.query(
      `UPDATE shopify_config SET ${updates.join(', ')} WHERE id = 1`,
      params
    );

    res.json({ ok: true });
  })
);

/** GET /test — verify Shopify credentials by fetching shop info. */
shopifyRouter.get(
  '/test',
  asyncHandler(async (_req, res) => {
    const result = await testShopifyConnection();
    res.json(result);
  })
);

/** POST /sync/products — fetch all products from Shopify and upsert. */
shopifyRouter.post(
  '/sync/products',
  asyncHandler(async (_req, res) => {
    const result = await syncProductsFromShopify();
    res.json(result);
  })
);

/** POST /sync/orders — fetch all orders from Shopify and import new ones. */
shopifyRouter.post(
  '/sync/orders',
  asyncHandler(async (_req, res) => {
    const result = await syncOrdersFromShopify();
    res.json(result);
  })
);

/** POST /import/products — upload Shopify products CSV (text/plain body). */
shopifyRouter.post(
  '/import/products',
  asyncHandler(async (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : (req.body as any)?.csv;
    if (!csv) return res.status(400).json({ error: 'CSV requerido en el body' });
    const products = parseShopifyProductsCsv(csv);
    if (products.length === 0) return res.status(400).json({ error: 'No se encontraron productos en el CSV' });
    const result = await syncProducts(products);
    res.json(result);
  })
);

/** POST /import/orders — upload Shopify orders CSV (text/plain body). */
shopifyRouter.post(
  '/import/orders',
  asyncHandler(async (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : (req.body as any)?.csv;
    if (!csv) return res.status(400).json({ error: 'CSV requerido en el body' });
    const orders = parseShopifyOrdersCsv(csv);
    if (orders.length === 0) return res.status(400).json({ error: 'No se encontraron órdenes en el CSV' });
    const result = await syncOrders(orders);
    res.json(result);
  })
);

/** GET /locations — list available Shopify locations for the dropdown. */
shopifyRouter.get(
  '/locations',
  asyncHandler(async (_req, res) => {
    const locations = await listShopifyLocations();
    res.json(locations);
  })
);

/** POST /inventory/pull — bootstrap: fetch inventory levels from Shopify into BH. */
shopifyRouter.post(
  '/inventory/pull',
  asyncHandler(async (_req, res) => {
    const result = await pullInventoryFromShopify();
    res.json(result);
  })
);

/** POST /inventory/push-all — retry every product with an unresolved sync error. */
shopifyRouter.post(
  '/inventory/push-all',
  asyncHandler(async (_req, res) => {
    const result = await pushPendingInventoryErrors();
    res.json(result);
  })
);

/** GET /inventory/errors — list pending sync errors for the UI. */
shopifyRouter.get(
  '/inventory/errors',
  asyncHandler(async (_req, res) => {
    const errors = await listInventoryErrors();
    res.json(errors);
  })
);
