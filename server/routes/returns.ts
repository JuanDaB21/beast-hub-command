import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert } from '../util';
import { tryPushInventory } from '../lib/inventorySync';

const SELECT_WITH_RELATIONS = `
  SELECT r.*,
    CASE WHEN o.id IS NOT NULL
      THEN json_build_object(
        'id', o.id, 'order_number', o.order_number, 'customer_name', o.customer_name
      )
      ELSE NULL END AS "order",
    CASE WHEN p.id IS NOT NULL
      THEN json_build_object(
        'id', p.id, 'sku', p.sku, 'name', p.name, 'stock', p.stock, 'cost', p.cost
      )
      ELSE NULL END AS product
  FROM returns r
  LEFT JOIN orders o ON o.id = r.order_id
  LEFT JOIN products p ON p.id = r.product_id
`;

const COLS = ['order_id', 'product_id', 'reason_category', 'notes', 'resolution_status'] as const;

export const returnsRouter = Router();

returnsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `${SELECT_WITH_RELATIONS} ORDER BY r.created_at DESC`
    );
    res.json(rows);
  })
);

returnsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildInsert('returns', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

interface ResolveBody {
  resolution: 'restocked' | 'scrapped';
  notes?: string;
  company_assumes_shipping: boolean;
  return_shipping_cost: number;
  product_id: string | null;
  current_stock: number | null;
  product_cost: number;
  order_number?: string | null;
  product_name?: string | null;
}

/**
 * POST /:id/resolve — resuelve la devolución. Si restocked, suma +1 al stock.
 * Si scrapped y product_cost>0, registra merma en financial_transactions.
 * Si la empresa asume flete, registra ese gasto también.
 * Todo en una transacción para evitar estados inconsistentes.
 */
returnsRouter.post(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const body = req.body as ResolveBody;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE returns
         SET resolution_status = $1,
             notes = $2,
             resolved_at = now(),
             company_assumes_shipping = $3,
             return_shipping_cost = $4
         WHERE id = $5`,
        [body.resolution, body.notes ?? null, body.company_assumes_shipping, body.return_shipping_cost, id]
      );

      if (body.resolution === 'restocked' && body.product_id) {
        const newStock = (body.current_stock ?? 0) + 1;
        await client.query('UPDATE products SET stock = $1 WHERE id = $2', [
          newStock,
          body.product_id,
        ]);
      }

      if (body.resolution === 'scrapped' && body.product_cost > 0) {
        await client.query(
          `INSERT INTO financial_transactions
           (transaction_type, amount, category, reference_type, reference_id, description)
           VALUES ('expense', $1, 'Pérdida por Merma', 'return', $2, $3)`,
          [
            body.product_cost,
            id,
            `Merma ${body.product_name ?? 'producto'} · pedido ${body.order_number ?? '—'}`,
          ]
        );
      }

      if (body.company_assumes_shipping && body.return_shipping_cost > 0) {
        await client.query(
          `INSERT INTO financial_transactions
           (transaction_type, amount, category, reference_type, reference_id, description)
           VALUES ('expense', $1, 'Logística RMA', 'return', $2, $3)`,
          [body.return_shipping_cost, id, `Flete devolución pedido ${body.order_number ?? '—'}`]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (body.resolution === 'restocked' && body.product_id) {
      await tryPushInventory(body.product_id);
    }

    res.json({ ok: true });
  })
);

returnsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM returns WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);
