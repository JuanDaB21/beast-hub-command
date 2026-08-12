import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert } from '../util';

const COLS = [
  'order_id',
  'product_id',
  'quantity',
  'unit_price',
  'kind',
  'external_name',
  'external_sku',
] as const;

/** Solo se pueden agregar/editar/quitar líneas mientras el pedido está en curso. */
const EDITABLE_STATUSES = ['pending', 'processing'];

export const orderItemsRouter = Router();

/** Refleja el stock de los productos tocados hacia Shopify (idempotente, no-throw). */
async function pushInventory(productIds: Iterable<string>) {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return;
  const { tryPushInventory } = await import('../lib/inventorySync');
  for (const id of ids) await tryPushInventory(id);
}

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

/**
 * POST acepta un objeto o un array (inserción transaccional).
 * Cada línea `kind='product'` con `product_id` descuenta su cantidad del stock, de
 * modo que el invariante "una línea de producto reserva su cantidad" se cumple desde
 * la creación. Solo permitido si el pedido está en `pending`/`processing`.
 */
orderItemsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const isArray = Array.isArray(req.body);
    const items = isArray ? req.body : [req.body];
    if (items.length === 0) return res.json([]);

    const orderId = items[0]?.order_id;
    if (!orderId) return res.status(400).json({ error: 'order_id requerido' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: ord } = await client.query(
        'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      if (!ord[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }
      if (!EDITABLE_STATUSES.includes(ord[0].status)) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'Solo se pueden editar pedidos pendientes o en proceso' });
      }

      const inserted: any[] = [];
      const touched: string[] = [];
      for (const item of items) {
        const { sql, params } = buildInsert('order_items', COLS, item);
        const { rows } = await client.query(sql, params);
        const row = rows[0];
        inserted.push(row);
        if (row.product_id && row.kind === 'product') {
          await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
            row.quantity,
            row.product_id,
          ]);
          touched.push(row.product_id);
        }
      }
      await client.query('COMMIT');

      await pushInventory(touched);

      return res.status(201).json(isArray ? inserted : inserted[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * PATCH /:id — dos ramas:
 *  A) `{ product_id }`  → asigna un producto a una línea "unknown" (Shopify import).
 *     Comportamiento existente, permitido en cualquier estado.
 *  B) `{ quantity?, unit_price? }` → edita la línea en un pedido editable, ajustando
 *     el stock por la diferencia de cantidad.
 */
orderItemsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const productId = req.body?.product_id;

    // ---- Rama A: asignación de producto a línea unknown ----
    if (productId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: cur } = await client.query(
          'SELECT product_id, quantity FROM order_items WHERE id = $1 FOR UPDATE',
          [id]
        );
        if (!cur[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Not found' });
        }
        const { rows } = await client.query(
          `UPDATE order_items
              SET product_id = $1, kind = 'product', external_name = NULL, external_sku = NULL
            WHERE id = $2
          RETURNING *`,
          [productId, id]
        );
        // Solo descuenta si la línea no estaba ya contada contra un producto.
        if (!cur[0].product_id) {
          await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
            cur[0].quantity,
            productId,
          ]);
        }
        await client.query('COMMIT');

        await pushInventory([productId]);

        return res.json(rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // ---- Rama B: edición de cantidad / precio ----
    const hasQty = req.body?.quantity !== undefined;
    const hasPrice = req.body?.unit_price !== undefined;
    if (!hasQty && !hasPrice) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }
    const newQty = hasQty ? Number(req.body.quantity) : undefined;
    if (hasQty && (!Number.isFinite(newQty) || (newQty as number) < 1)) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: cur } = await client.query(
        `SELECT oi.product_id, oi.quantity, oi.kind, o.status
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.id = $1
          FOR UPDATE OF oi`,
        [id]
      );
      if (!cur[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Not found' });
      }
      if (!EDITABLE_STATUSES.includes(cur[0].status)) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'Solo se pueden editar pedidos pendientes o en proceso' });
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      if (hasQty) {
        params.push(newQty);
        sets.push(`quantity = $${params.length}`);
      }
      if (hasPrice) {
        params.push(Number(req.body.unit_price));
        sets.push(`unit_price = $${params.length}`);
      }
      params.push(id);
      const { rows } = await client.query(
        `UPDATE order_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );

      const touched: string[] = [];
      if (hasQty && cur[0].product_id && cur[0].kind === 'product') {
        const delta = (newQty as number) - cur[0].quantity; // +delta reserva más → baja stock
        if (delta !== 0) {
          await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
            delta,
            cur[0].product_id,
          ]);
          touched.push(cur[0].product_id);
        }
      }
      await client.query('COMMIT');

      await pushInventory(touched);

      res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * DELETE /:id — quita una línea de un pedido editable y devuelve su cantidad al stock
 * (para líneas de producto). Solo permitido en `pending`/`processing`.
 */
orderItemsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: cur } = await client.query(
        `SELECT oi.product_id, oi.quantity, oi.kind, o.status
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.id = $1
          FOR UPDATE OF oi`,
        [id]
      );
      if (!cur[0]) {
        await client.query('ROLLBACK');
        return res.json({ ok: true }); // idempotente
      }
      if (!EDITABLE_STATUSES.includes(cur[0].status)) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'Solo se pueden editar pedidos pendientes o en proceso' });
      }
      await client.query('DELETE FROM order_items WHERE id = $1', [id]);
      const touched: string[] = [];
      if (cur[0].product_id && cur[0].kind === 'product') {
        await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [
          cur[0].quantity,
          cur[0].product_id,
        ]);
        touched.push(cur[0].product_id);
      }
      await client.query('COMMIT');

      await pushInventory(touched);

      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);
