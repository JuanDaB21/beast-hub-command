import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const INSERT_COLS = [
  'transaction_type',
  'amount',
  'category',
  'reference_type',
  'reference_id',
  'description',
  'charged_to_staff_id',
];

export const financeRouter = Router();

financeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, category, from, to, search } = req.query as Record<string, string | undefined>;

    const where: string[] = [];
    const params: unknown[] = [];

    if (type && type !== 'all') {
      params.push(type);
      where.push(`ft.transaction_type = $${params.length}`);
    }
    if (category && category !== 'all') {
      params.push(category);
      where.push(`ft.category = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`ft.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`ft.created_at <= $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`ft.description ILIKE $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT ft.*,
              CASE
                WHEN p.id IS NULL THEN NULL
                ELSE json_build_object('id', p.id, 'full_name', p.full_name)
              END AS charged_to
       FROM financial_transactions ft
       LEFT JOIN profiles p ON p.id = ft.charged_to_staff_id
       ${whereSql}
       ORDER BY ft.created_at DESC
       LIMIT 5000`,
      params
    );
    res.json(rows);
  })
);

financeRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body as Record<string, unknown>;
    const values = INSERT_COLS.map((k) => (k === 'reference_type' ? (b[k] ?? 'manual') : (b[k] ?? null)));
    const placeholders = INSERT_COLS.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO financial_transactions (${INSERT_COLS.join(', ')})
       VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json(rows[0]);
  })
);

/**
 * PATCH /:id — campos contables solo en transacciones manuales. El campo
 * charged_to_staff_id es metadata de responsable y se permite editar también
 * en transacciones automáticas.
 */
financeRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { rows: cur } = await pool.query(
      'SELECT reference_type FROM financial_transactions WHERE id = $1',
      [id]
    );
    if (!cur[0]) return res.status(404).json({ error: 'Not found' });

    const body = req.body as Record<string, unknown>;
    const isManual = !cur[0].reference_type || cur[0].reference_type === 'manual';
    const accountingFields = ['amount', 'category', 'description'];
    const wantsAccountingChange = accountingFields.some((k) =>
      Object.prototype.hasOwnProperty.call(body, k),
    );
    if (wantsAccountingChange && !isManual) {
      return res.status(400).json({
        error:
          'Solo se pueden editar transacciones manuales. Las automáticas se gestionan desde su módulo de origen.',
      });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (isManual) {
      if (Object.prototype.hasOwnProperty.call(body, 'amount')) push('amount', body.amount);
      if (Object.prototype.hasOwnProperty.call(body, 'category')) push('category', body.category);
      if (Object.prototype.hasOwnProperty.call(body, 'description')) push('description', body.description ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'charged_to_staff_id')) {
      push('charged_to_staff_id', body.charged_to_staff_id ?? null);
    }
    if (sets.length === 0) {
      return res.json(cur[0]);
    }
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE financial_transactions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    res.json(rows[0]);
  })
);

financeRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { rows: cur } = await pool.query(
      'SELECT reference_type FROM financial_transactions WHERE id = $1',
      [id]
    );
    if (!cur[0]) return res.status(404).json({ error: 'Not found' });
    if (cur[0].reference_type && cur[0].reference_type !== 'manual') {
      return res.status(400).json({
        error:
          'Solo se pueden eliminar transacciones manuales. Las automáticas se gestionan desde su módulo de origen.',
      });
    }
    await pool.query('DELETE FROM financial_transactions WHERE id = $1', [id]);
    res.json({ ok: true });
  })
);
