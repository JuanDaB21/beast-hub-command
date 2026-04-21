import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert, buildUpdate } from '../util';

const COLS = [
  'name',
  'contact_phone',
  'contact_email',
  'address',
  'notes',
  'active',
] as const;

export const suppliersRouter = Router();

suppliersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM suppliers ORDER BY created_at DESC'
    );
    res.json(rows);
  })
);

suppliersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildInsert('suppliers', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

suppliersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildUpdate('suppliers', COLS, req.body, String(req.params.id));
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

suppliersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM suppliers WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);
