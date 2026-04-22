import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const COD_COLUMNS = `
  id, order_number, customer_name, customer_phone, status, source, is_cod,
  order_confirmed, order_confirmed_at, confirmed_by_staff_id,
  cod_confirmed, total, carrier, tracking_number, shipped_at,
  cod_received_at, received_by_staff_id, created_at
`;

export const codRouter = Router();

/** GET /api/cod/orders — COD orders feed for the COD page. */
codRouter.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COD_COLUMNS} FROM orders WHERE is_cod = true ORDER BY created_at DESC`
    );
    res.json(rows);
  })
);

/**
 * POST /api/cod/orders/:id/confirm
 * Marks the order as order_confirmed with the current staff.
 */
codRouter.post(
  '/orders/:id/confirm',
  asyncHandler(async (req, res) => {
    const staffId = req.user?.id ?? null;
    const { rows } = await pool.query(
      `UPDATE orders
       SET order_confirmed = true,
           order_confirmed_at = now(),
           confirmed_by_staff_id = $1
       WHERE id = $2
       RETURNING ${COD_COLUMNS}`,
      [staffId, String(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

/**
 * POST /api/cod/orders/:id/receipt
 * Registers the COD cash receipt. Shopify orders must be confirmed first.
 */
codRouter.post(
  '/orders/:id/receipt',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const staffId = req.user?.id ?? null;

    const { rows: check } = await pool.query(
      'SELECT source, order_confirmed FROM orders WHERE id = $1',
      [id]
    );
    const order = check[0];
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (order.source === 'shopify' && !order.order_confirmed) {
      return res
        .status(400)
        .json({ error: 'Debes confirmar el pedido antes de registrar el recaudo' });
    }

    const { rows } = await pool.query(
      `UPDATE orders
       SET cod_confirmed = true,
           cod_received_at = now(),
           received_by_staff_id = $1
       WHERE id = $2
       RETURNING ${COD_COLUMNS}`,
      [staffId, id]
    );
    res.json(rows[0]);
  })
);
