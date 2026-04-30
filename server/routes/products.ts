import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert, buildUpdate } from '../util';
import { tryPushInventory } from '../lib/inventorySync';

const COLS = [
  'sku',
  'name',
  'description',
  'stock',
  'safety_stock',
  'aging_days',
  'price',
  'cost',
  'active',
  'product_url',
  'base_color',
  'print_color',
  'size',
  'print_height_cm',
  'parent_id',
  'is_parent',
  'print_design',
  'print_design_id',
] as const;

export const productsRouter = Router();

/**
 * GET /api/products
 * Optional filters: ?active=true, ?parent_id=<id>, ?ids=<csv>
 * Fields can be narrowed with ?select=id,sku,name,price,stock,active
 */
productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const active = req.query.active;
    const parentId = req.query.parent_id as string | undefined;
    const idsParam = req.query.ids as string | undefined;
    const select = typeof req.query.select === 'string' ? req.query.select : '*';
    // Basic safety: only allow * or comma-separated column names matching [a-z_]
    const safeSelect =
      select === '*' || /^[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*$/i.test(select)
        ? select
        : '*';

    const where: string[] = [];
    const params: unknown[] = [];
    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      where.push(`active = $${params.length}`);
    }
    if (parentId) {
      params.push(parentId);
      where.push(`parent_id = $${params.length}`);
    }
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        params.push(ids);
        where.push(`id = ANY($${params.length}::uuid[])`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT ${safeSelect} FROM products ${whereSql} ORDER BY name`,
      params
    );
    res.json(rows);
  })
);

productsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    // Bulk insert if array
    if (Array.isArray(req.body)) {
      if (req.body.length === 0) return res.json([]);
      const client = await pool.connect();
      const inserted: any[] = [];
      try {
        await client.query('BEGIN');
        for (const item of req.body) {
          const { sql, params } = buildInsert('products', COLS, item);
          const { rows } = await client.query(sql, params);
          inserted.push(rows[0]);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return res.status(201).json(inserted);
    }

    const { sql, params } = buildInsert('products', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

productsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildUpdate('products', COLS, req.body, String(req.params.id));
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'stock')) {
      await tryPushInventory(String(req.params.id));
    }
    res.json(rows[0]);
  })
);

productsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM products WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

/** Bulk delete: body = { ids: string[] } */
productsRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.json({ deleted: 0 });
    const { rowCount } = await pool.query(
      'DELETE FROM products WHERE id = ANY($1::uuid[])',
      [ids]
    );
    res.json({ deleted: rowCount });
  })
);
