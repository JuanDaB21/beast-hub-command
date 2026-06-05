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

/**
 * PATCH /:id — assign a product to an "unknown" line (manual matching).
 * Sets product_id, promotes kind to 'product', clears external_* fields, and
 * mirrors Shopify's stock decrement (these lines come from Shopify imports where
 * Shopify already decremented). Pushes the new stock back to Shopify after commit.
 */
orderItemsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const productId = req.body?.product_id;
    if (!productId) return res.status(400).json({ error: 'product_id requerido' });

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
      // Only decrement if this line wasn't already counted against a product.
      if (!cur[0].product_id) {
        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
          cur[0].quantity,
          productId,
        ]);
      }
      await client.query('COMMIT');

      // Mirror to Shopify (idempotent). Lazy import to avoid a circular dep.
      const { tryPushInventory } = await import('../lib/inventorySync');
      await tryPushInventory(productId);

      res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

orderItemsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM order_items WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);
