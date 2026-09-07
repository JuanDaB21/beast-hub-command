import { Router } from 'express';
import type { PoolClient } from 'pg';
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

/**
 * POST acepta un objeto o un array (inserción transaccional). Registrar varias
 * devoluciones de un mismo pedido (una por producto) llega como array.
 */
returnsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const isArray = Array.isArray(req.body);
    const items = isArray ? req.body : [req.body];
    if (items.length === 0) return res.status(201).json([]);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted: any[] = [];
      for (const item of items) {
        const { sql, params } = buildInsert('returns', COLS, item);
        const { rows } = await client.query(sql, params);
        inserted.push(rows[0]);
      }

      const orderIds = Array.from(
        new Set(inserted.map((r) => r.order_id).filter((id): id is string => !!id))
      );
      const cancelled: { id: string; order_number: string }[] = [];
      for (const orderId of orderIds) {
        const order = await cancelIfFullyReturned(client, orderId);
        if (order) cancelled.push(order);
      }

      await client.query('COMMIT');
      const payload = isArray ? inserted : inserted[0];
      return res.status(201).json(
        isArray ? { returns: payload, cancelled_orders: cancelled } : { ...payload, cancelled_orders: cancelled }
      );
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * Un pedido devuelto por completo no se va a entregar, así que deja de ser una
 * venta: se cancela solo. La excepción es el pedido ya cobrado — ahí el dinero
 * sí entró y la salida se registra a mano en el libro de finanzas.
 *
 * OJO: cancelar NO devuelve stock en este sistema. La reposición la hace la
 * resolución 'restocked' de cada devolución; duplicarla aquí inflaría el
 * inventario.
 */
async function cancelIfFullyReturned(
  client: PoolClient,
  orderId: string
): Promise<{ id: string; order_number: string } | null> {
  const { rows: orderRows } = await client.query(
    `SELECT id, order_number, status, is_cod, cod_confirmed, payment_status
       FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  const order = orderRows[0];
  if (!order || order.status === 'cancelled') return null;

  const isPaid = order.is_cod ? !!order.cod_confirmed : order.payment_status === 'paid';
  if (isPaid) return null;

  const { rows: coverage } = await client.query(
    `SELECT
       COUNT(DISTINCT oi.product_id)::int AS ordered,
       COUNT(DISTINCT r.product_id)::int AS returned
     FROM order_items oi
     LEFT JOIN returns r
       ON r.order_id = oi.order_id AND r.product_id = oi.product_id
     WHERE oi.order_id = $1 AND oi.kind = 'product' AND oi.product_id IS NOT NULL`,
    [orderId]
  );
  const { ordered, returned } = coverage[0] ?? { ordered: 0, returned: 0 };
  if (ordered === 0 || returned < ordered) return null;

  await client.query(
    `UPDATE orders SET status = 'cancelled', cancelled_by_return = true WHERE id = $1`,
    [orderId]
  );
  return { id: order.id, order_number: order.order_number };
}

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

/**
 * DELETE /:id — para una devolución registrada que al final se canceló.
 *
 * Solo se permite mientras esté 'pending': una vez resuelta ya movió stock y
 * asientos contables, y revertir eso a ciegas desajustaría el inventario.
 * Si la devolución había cancelado su pedido automáticamente, se restaura.
 */
returnsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT id, order_id, resolution_status FROM returns WHERE id = $1 FOR UPDATE',
        [id]
      );
      const ret = rows[0];
      if (!ret) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Devolución no encontrada' });
      }
      if (ret.resolution_status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Solo se pueden eliminar devoluciones pendientes; esta ya fue resuelta',
        });
      }

      await client.query('DELETE FROM returns WHERE id = $1', [id]);

      let restoredOrder: string | null = null;
      if (ret.order_id) {
        const { rows: orderRows } = await client.query(
          `SELECT id, order_number, status, cancelled_by_return
             FROM orders WHERE id = $1 FOR UPDATE`,
          [ret.order_id]
        );
        const order = orderRows[0];
        if (order?.cancelled_by_return && order.status === 'cancelled') {
          await client.query(
            `UPDATE orders SET status = 'pending', cancelled_by_return = false WHERE id = $1`,
            [order.id]
          );
          restoredOrder = order.order_number;
        }
      }

      await client.query('COMMIT');
      res.json({ ok: true, restored_order: restoredOrder });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);
