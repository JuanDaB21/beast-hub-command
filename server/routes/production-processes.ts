import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert, buildUpdate } from '../util';

const COLS = ['name', 'cost', 'active'] as const;

export const productionProcessesRouter = Router();

/* -------- Catalog CRUD -------- */

productionProcessesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const active = req.query.active;
    const where = active === 'true' ? 'WHERE active = true'
      : active === 'false' ? 'WHERE active = false'
      : '';
    const { rows } = await pool.query(
      `SELECT * FROM production_processes ${where} ORDER BY name`
    );
    res.json(rows);
  })
);

productionProcessesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildInsert('production_processes', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

productionProcessesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildUpdate('production_processes', COLS, req.body, String(req.params.id));
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

productionProcessesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM production_processes WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

/* -------- Product assignment -------- */

/**
 * GET /by-products?product_ids=a,b,c
 * Returns product_processes joined with the catalog for the given products.
 */
productionProcessesRouter.get(
  '/by-products',
  asyncHandler(async (req, res) => {
    const productIds = (req.query.product_ids as string | undefined)?.split(',').filter(Boolean) ?? [];
    if (productIds.length === 0) return res.json([]);
    const { rows } = await pool.query(
      `SELECT pp.id, pp.product_id, pp.process_id,
              json_build_object('id', pr.id, 'name', pr.name, 'cost', pr.cost, 'active', pr.active) AS process
       FROM product_processes pp
       JOIN production_processes pr ON pr.id = pp.process_id
       WHERE pp.product_id = ANY($1::uuid[])`,
      [productIds]
    );
    res.json(rows);
  })
);

/**
 * PUT /product/:productId  { process_ids: string[] }
 * Replaces the full set of processes assigned to a product.
 */
productionProcessesRouter.put(
  '/product/:productId',
  asyncHandler(async (req, res) => {
    const productId = String(req.params.productId);
    const processIds: string[] = Array.isArray(req.body?.process_ids) ? req.body.process_ids : [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM product_processes WHERE product_id = $1', [productId]);
      for (const pid of processIds) {
        await client.query(
          `INSERT INTO product_processes (product_id, process_id)
           VALUES ($1, $2) ON CONFLICT (product_id, process_id) DO NOTHING`,
          [productId, pid]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ ok: true, count: processIds.length });
  })
);
