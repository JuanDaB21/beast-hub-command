import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const ITEMS_SUBQUERY = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'product_id', oi.product_id,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'product', CASE WHEN p.id IS NOT NULL
            THEN json_build_object('id', p.id, 'sku', p.sku, 'name', p.name)
            ELSE NULL END
        )
        ORDER BY oi.created_at
      )
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ),
    '[]'::json
  ) AS items
`;

export const logisticsRouter = Router();

/** GET /api/logistics/orders — orders in the shipping flow. */
logisticsRouter.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT o.*, ${ITEMS_SUBQUERY}
       FROM orders o
       WHERE o.status IN ('pending','processing','shipped')
       ORDER BY o.created_at ASC`
    );
    res.json(rows);
  })
);
