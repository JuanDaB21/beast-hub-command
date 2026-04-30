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
import {
  bulkAutoLink,
  resolveColorId,
  resolveSizeId,
  findRawMaterial,
  upsertLinkAndMaterialize,
  normalize,
} from '../lib/baseLinking';

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

// ===========================================================================
// BOM / Base linking endpoints
// ===========================================================================

/**
 * GET /links/unlinked
 * Returns Shopify-synced children that have no product_base_links row,
 * grouped by parent. Includes resolver suggestions per child.
 */
shopifyRouter.get(
  '/links/unlinked',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<{
      parent_id: string;
      parent_name: string;
      parent_sku: string;
      base_group_key: string | null;
      child_id: string;
      child_sku: string;
      base_color: string | null;
      size: string | null;
    }>(
      `SELECT p.id AS parent_id, p.name AS parent_name, p.sku AS parent_sku,
              p.base_group_key,
              c.id AS child_id, c.sku AS child_sku, c.base_color, c.size
         FROM products p
         JOIN products c ON c.parent_id = p.id AND c.is_parent = false
        WHERE (p.shopify_product_id IS NOT NULL OR c.shopify_variant_id IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM product_base_links pbl WHERE pbl.product_id = c.id
          )
        ORDER BY p.name, c.sku`
    );

    // Group by parent
    const parentMap = new Map<string, {
      parent_id: string;
      parent_name: string;
      parent_sku: string;
      base_group_key: string | null;
      children: typeof rows;
    }>();
    for (const r of rows) {
      if (!parentMap.has(r.parent_id)) {
        parentMap.set(r.parent_id, {
          parent_id: r.parent_id,
          parent_name: r.parent_name,
          parent_sku: r.parent_sku,
          base_group_key: r.base_group_key,
          children: [],
        });
      }
      parentMap.get(r.parent_id)!.children.push(r);
    }

    res.json(Array.from(parentMap.values()));
  })
);

/**
 * POST /links/preview
 * Dry-run: resolve color+size per child of parent_id against a given base_group_key.
 * Does not write anything.
 */
shopifyRouter.post(
  '/links/preview',
  asyncHandler(async (req, res) => {
    const { parent_id, base_group_key, print_design_id, print_height_cm } =
      req.body as {
        parent_id: string;
        base_group_key: string;
        print_design_id?: string | null;
        print_height_cm?: number;
      };

    if (!parent_id || !base_group_key) {
      return res.status(400).json({ error: 'parent_id y base_group_key requeridos' });
    }

    const baseGroupKey = base_group_key;

    const { rows: children } = await pool.query<{
      id: string;
      sku: string;
      base_color: string | null;
      size: string | null;
    }>(
      `SELECT id, sku, base_color, size FROM products
        WHERE parent_id = $1 AND is_parent = false
        ORDER BY sku`,
      [parent_id]
    );

    const client = await pool.connect();
    try {
      const previews = [];
      for (const c of children) {
        const colorId = await resolveColorId(client, c.base_color);
        const sizeId = await resolveSizeId(client, c.size);
        const rmId = await findRawMaterial(client, { base_group_key: baseGroupKey, color_id: colorId, size_id: sizeId });

        previews.push({
          product_id: c.id,
          sku: c.sku,
          base_color: c.base_color,
          size: c.size,
          resolved_color_id: colorId,
          resolved_size_id: sizeId,
          raw_material_id: rmId,
          can_link: !!rmId,
        });
      }
      res.json({ base_group_key: baseGroupKey, print_design_id: print_design_id ?? null, print_height_cm: print_height_cm ?? 0, previews });
    } finally {
      client.release();
    }
  })
);

/**
 * PUT /links/parent/:id/base-group
 * Set the base_group_key on a parent and trigger bulkAutoLink.
 * Body: { base_group_key, print_design_id?, print_height_cm? }
 */
shopifyRouter.put(
  '/links/parent/:id/base-group',
  asyncHandler(async (req, res) => {
    const parentId = String(req.params.id);
    const { base_group_key, print_design_id, print_height_cm } =
      req.body as {
        base_group_key: string;
        print_design_id?: string | null;
        print_height_cm?: number;
      };

    if (!base_group_key) {
      return res.status(400).json({ error: 'base_group_key requerido' });
    }

    // Persist key + optional print_design on parent.
    const sets: string[] = ['base_group_key = $1', 'updated_at = now()'];
    const params: unknown[] = [base_group_key, parentId];
    if (print_design_id !== undefined) {
      params.splice(params.length - 1, 0, print_design_id ?? null);
      sets.push(`print_design_id = $${params.length - 1}`);
    }
    if (print_height_cm !== undefined) {
      params.splice(params.length - 1, 0, print_height_cm);
      sets.push(`print_height_cm = $${params.length - 1}`);
    }

    await pool.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );

    const client = await pool.connect();
    try {
      const linkResult = await bulkAutoLink(client, parentId, {
        default_print_design_id: print_design_id,
        default_print_height_cm: print_height_cm,
      });
      res.json(linkResult);
    } finally {
      client.release();
    }
  })
);

/**
 * POST /links/bulk
 * Upsert links + materialize BOM for a list of products. Idempotent.
 */
shopifyRouter.post(
  '/links/bulk',
  asyncHandler(async (req, res) => {
    const items = req.body as Array<{
      product_id: string;
      raw_material_id: string;
      print_design_id?: string | null;
      print_height_cm?: number;
    }>;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de items' });
    }

    const client = await pool.connect();
    const results: Array<{ product_id: string; ok: boolean; error?: string }> = [];
    try {
      for (const item of items) {
        try {
          await client.query('BEGIN');
          await upsertLinkAndMaterialize(client, {
            product_id: item.product_id,
            raw_material_id: item.raw_material_id,
            print_design_id: item.print_design_id ?? null,
            print_height_cm: item.print_height_cm ?? 0,
            link_source: 'wizard',
          });
          await client.query('COMMIT');
          results.push({ product_id: item.product_id, ok: true });
        } catch (err: any) {
          await client.query('ROLLBACK');
          results.push({ product_id: item.product_id, ok: false, error: err.message });
        }
      }
    } finally {
      client.release();
    }

    const failed = results.filter((r) => !r.ok);
    res.json({ linked: results.filter((r) => r.ok).length, errors: failed });
  })
);

/**
 * DELETE /links/:product_id
 * Remove a link and its materialized BOM rows.
 */
shopifyRouter.delete(
  '/links/:product_id',
  asyncHandler(async (req, res) => {
    const productId = String(req.params.product_id);
    await pool.query('DELETE FROM product_base_links WHERE product_id = $1', [productId]);
    await pool.query('DELETE FROM product_materials WHERE product_id = $1', [productId]);
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Alias management
// ---------------------------------------------------------------------------

/** GET /aliases/colors */
shopifyRouter.get(
  '/aliases/colors',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ca.alias_norm, ca.color_id, c.name AS color_name, c.hex_code
         FROM color_aliases ca JOIN colors c ON c.id = ca.color_id
        ORDER BY ca.alias_norm`
    );
    res.json(rows);
  })
);

/** POST /aliases/colors — { alias, color_id } */
shopifyRouter.post(
  '/aliases/colors',
  asyncHandler(async (req, res) => {
    const { alias, color_id } = req.body as { alias: string; color_id: string };
    if (!alias?.trim() || !color_id) return res.status(400).json({ error: 'alias y color_id requeridos' });
    const aliasNorm = normalize(alias);
    await pool.query(
      `INSERT INTO color_aliases (alias_norm, color_id) VALUES ($1, $2)
       ON CONFLICT (alias_norm) DO UPDATE SET color_id = EXCLUDED.color_id`,
      [aliasNorm, color_id]
    );
    res.json({ ok: true, alias_norm: aliasNorm });
  })
);

/** DELETE /aliases/colors/:alias_norm */
shopifyRouter.delete(
  '/aliases/colors/:alias_norm',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM color_aliases WHERE alias_norm = $1', [req.params.alias_norm]);
    res.json({ ok: true });
  })
);

/** GET /aliases/sizes */
shopifyRouter.get(
  '/aliases/sizes',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT sa.alias_norm, sa.size_id, s.label AS size_label
         FROM size_aliases sa JOIN sizes s ON s.id = sa.size_id
        ORDER BY sa.alias_norm`
    );
    res.json(rows);
  })
);

/** POST /aliases/sizes — { alias, size_id } */
shopifyRouter.post(
  '/aliases/sizes',
  asyncHandler(async (req, res) => {
    const { alias, size_id } = req.body as { alias: string; size_id: string };
    if (!alias?.trim() || !size_id) return res.status(400).json({ error: 'alias y size_id requeridos' });
    const aliasNorm = normalize(alias);
    await pool.query(
      `INSERT INTO size_aliases (alias_norm, size_id) VALUES ($1, $2)
       ON CONFLICT (alias_norm) DO UPDATE SET size_id = EXCLUDED.size_id`,
      [aliasNorm, size_id]
    );
    res.json({ ok: true, alias_norm: aliasNorm });
  })
);

/** DELETE /aliases/sizes/:alias_norm */
shopifyRouter.delete(
  '/aliases/sizes/:alias_norm',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM size_aliases WHERE alias_norm = $1', [req.params.alias_norm]);
    res.json({ ok: true });
  })
);
