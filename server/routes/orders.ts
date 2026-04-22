import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert, buildUpdate } from '../util';

const COLS = [
  'order_number',
  'source',
  'customer_name',
  'customer_phone',
  'status',
  'is_cod',
  'cod_confirmed',
  'payment_method',
  'total',
  'tracking_number',
  'shipped_at',
  'delay_reason',
  'cod_received_at',
  'received_by_staff_id',
  'carrier',
  'order_confirmed',
  'order_confirmed_at',
  'confirmed_by_staff_id',
  'shipping_cost',
  'customer_pays_shipping',
] as const;

/** Build nested items JSON subquery (matching Supabase select shape). */
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

export const ordersRouter = Router();

/**
 * GET /api/orders
 * Filters: ?status=<csv>, ?is_cod=true|false, ?from=<iso>, ?to=<iso>,
 *          ?not_status=<csv>, ?limit=<n>
 * Always includes nested items with product.
 */
ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const statusCsv = req.query.status as string | undefined;
    const notStatusCsv = req.query.not_status as string | undefined;
    const isCod = req.query.is_cod as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Number(req.query.limit) || 5000, 10000);

    const where: string[] = [];
    const params: unknown[] = [];
    if (statusCsv) {
      const statuses = statusCsv.split(',').filter(Boolean);
      if (statuses.length) {
        params.push(statuses);
        where.push(`o.status = ANY($${params.length}::order_status[])`);
      }
    }
    if (notStatusCsv) {
      const statuses = notStatusCsv.split(',').filter(Boolean);
      if (statuses.length) {
        params.push(statuses);
        where.push(`NOT (o.status = ANY($${params.length}::order_status[]))`);
      }
    }
    if (isCod === 'true' || isCod === 'false') {
      params.push(isCod === 'true');
      where.push(`o.is_cod = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`o.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`o.created_at <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT o.*, ${ITEMS_SUBQUERY}
       FROM orders o
       ${whereSql}
       ORDER BY o.created_at ${order}
       LIMIT ${limit}`,
      params
    );
    res.json(rows);
  })
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT o.*, ${ITEMS_SUBQUERY} FROM orders o WHERE o.id = $1`,
      [String(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

ordersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildInsert('orders', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

ordersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    // Business rule: if the order has customer_pays_shipping=true and the
    // client tries to set a shipping_cost, coerce it to 0.
    if (typeof body.shipping_cost === 'number') {
      const { rows: cur } = await pool.query(
        'SELECT customer_pays_shipping FROM orders WHERE id = $1',
        [String(req.params.id)]
      );
      if (cur[0]?.customer_pays_shipping) body.shipping_cost = 0;
    }
    const { sql, params } = buildUpdate('orders', COLS, body, String(req.params.id));
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

ordersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM orders WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);
