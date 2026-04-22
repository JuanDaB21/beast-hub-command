import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const INSERT_COLS = ['transaction_type', 'amount', 'category', 'reference_type', 'reference_id', 'description'];

export const financeRouter = Router();

financeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, category, from, to, search } = req.query as Record<string, string | undefined>;

    const where: string[] = [];
    const params: unknown[] = [];

    if (type && type !== 'all') {
      params.push(type);
      where.push(`transaction_type = $${params.length}`);
    }
    if (category && category !== 'all') {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`created_at <= $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`description ILIKE $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT * FROM financial_transactions ${whereSql} ORDER BY created_at DESC LIMIT 5000`,
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
 * PATCH /:id — solo transacciones manuales. Las automáticas (referencia no-'manual')
 * deben gestionarse desde su módulo de origen.
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
    if (cur[0].reference_type && cur[0].reference_type !== 'manual') {
      return res.status(400).json({
        error:
          'Solo se pueden editar transacciones manuales. Las automáticas se gestionan desde su módulo de origen.',
      });
    }
    const { amount, category, description } = req.body as Record<string, unknown>;
    const { rows } = await pool.query(
      `UPDATE financial_transactions
       SET amount = $1, category = $2, description = $3
       WHERE id = $4 RETURNING *`,
      [amount, category, description ?? null, id]
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
