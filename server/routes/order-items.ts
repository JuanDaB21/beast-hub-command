import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert } from '../util';

const COLS = ['order_id', 'product_id', 'quantity', 'unit_price'] as const;

export const orderItemsRouter = Router();

orderItemsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orderId = req.query.order_id as string | undefined;
    if (!orderId) {
      return res.status(400).json({ error: 'order_id requerido' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
      [orderId]
    );
    res.json(rows);
  })
);

/** POST accepts a single item or an array for bulk insert (transactional). */
orderItemsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (Array.isArray(req.body)) {
      if (req.body.length === 0) return res.json([]);
      const client = await pool.connect();
      const inserted: any[] = [];
      try {
        await client.query('BEGIN');
        for (const item of req.body) {
          const { sql, params } = buildInsert('order_items', COLS, item);
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

    const { sql, params } = buildInsert('order_items', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

orderItemsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM order_items WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);
