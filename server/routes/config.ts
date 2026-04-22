import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

export const configRouter = Router();

/** GET / — returns all configs as { [id]: value } numeric map. */
configRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT id, value, updated_at FROM global_configs');
    const map: Record<string, number> = {};
    for (const r of rows) map[r.id] = Number(r.value);
    res.json(map);
  })
);

/** PATCH /:id — upsert a single config. */
configRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const value = Number((req.body as { value?: number }).value);
    if (Number.isNaN(value)) return res.status(400).json({ error: 'value numérico requerido' });
    const { rows } = await pool.query(
      `INSERT INTO global_configs (id, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE
         SET value = EXCLUDED.value, updated_at = now()
       RETURNING *`,
      [id, value]
    );
    res.json(rows[0]);
  })
);

/** GET /gross-revenue-current-month — suma de orders.total del mes corriente (no cancelados). */
configRouter.get(
  '/gross-revenue-current-month',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(total), 0)::numeric AS total
       FROM orders
       WHERE status <> 'cancelled'
         AND created_at >= date_trunc('month', now())
         AND created_at < date_trunc('month', now()) + interval '1 month'`
    );
    res.json({ total: Number(rows[0]?.total ?? 0) });
  })
);
