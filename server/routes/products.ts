import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert, buildUpdate } from '../util';
import { tryPushInventory } from '../lib/inventorySync';
import { relinkChildrenByPrintDesign } from '../lib/baseLinking';

const COLS = [
  'sku',
  'name',
  'description',
  'stock',
  'safety_stock',
  'aging_days',
  'price',
  'cost',
  'active',
  'product_url',
  'base_color',
  'print_color',
  'size',
  'print_height_cm',
  'parent_id',
  'is_parent',
  'print_design',
  'print_design_id',
] as const;

export const productsRouter = Router();

/**
 * GET /api/products
 * Optional filters: ?active=true, ?parent_id=<id>, ?ids=<csv>
 * Fields can be narrowed with ?select=id,sku,name,price,stock,active
 */
productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const active = req.query.active;
    const parentId = req.query.parent_id as string | undefined;
    const idsParam = req.query.ids as string | undefined;
    const select = typeof req.query.select === 'string' ? req.query.select : '*';
    // Basic safety: only allow * or comma-separated column names matching [a-z_]
    const safeSelect =
      select === '*' || /^[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*$/i.test(select)
        ? select
        : '*';

    const where: string[] = [];
    const params: unknown[] = [];
    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      where.push(`active = $${params.length}`);
    }
    if (parentId) {
      params.push(parentId);
      where.push(`parent_id = $${params.length}`);
    }
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        params.push(ids);
        where.push(`id = ANY($${params.length}::uuid[])`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT ${safeSelect} FROM products ${whereSql} ORDER BY name`,
      params
    );
    res.json(rows);
  })
);

productsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    // Bulk insert if array
    if (Array.isArray(req.body)) {
      if (req.body.length === 0) return res.json([]);
      const client = await pool.connect();
      const inserted: any[] = [];
      try {
        await client.query('BEGIN');
        for (const item of req.body) {
          const { sql, params } = buildInsert('products', COLS, item);
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

    const { sql, params } = buildInsert('products', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

productsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { sql, params } = buildUpdate('products', COLS, req.body, id);
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'stock')) {
      await tryPushInventory(id);
    }

    // If a parent's print_design_id changed, re-materialize BOM for all linked children.
    if (rows[0].is_parent && Object.prototype.hasOwnProperty.call(req.body ?? {}, 'print_design_id')) {
      const client = await pool.connect();
      try {
        await relinkChildrenByPrintDesign(
          client,
          id,
          rows[0].print_design_id ?? null,
          Number(rows[0].print_height_cm ?? 0)
        );
      } catch (err) {
        console.error('[products.patch] relinkChildrenByPrintDesign failed:', err);
      } finally {
        client.release();
      }
    }

    res.json(rows[0]);
  })
);

/**
 * POST /api/products/:id/merge-into/:targetId
 *
 * Fusiona una variante duplicada dentro de la correcta y la elimina. Existe porque
 * `DELETE /products/:id` es imposible en cuanto el producto tiene historial:
 * `work_order_items.product_id` y `returns.product_id` son FK sin `ON DELETE` (revientan
 * con 23503) y `order_items.product_id` es `ON DELETE SET NULL` (dejaría la venta huérfana).
 *
 * Mueve las filas de historial al destino y traslada con ellas su efecto de stock:
 *  - cada línea `kind='product'` descontó su `quantity` al crearse y cancelar el pedido
 *    NO la devuelve → la suma de las líneas vigentes es el decremento aún aplicado;
 *  - cada ítem de una OT `completed` sumó su `quantity_to_produce` (`complete_work_order`);
 *  - cada devolución `restocked` sumó 1 (`returns/:id/resolve`).
 */
productsRouter.post(
  '/:id/merge-into/:targetId',
  asyncHandler(async (req, res) => {
    const sourceId = String(req.params.id);
    const targetId = String(req.params.targetId);

    if (sourceId === targetId) {
      return res.status(400).json({ error: 'El origen y el destino son el mismo producto' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: locked } = await client.query(
        'SELECT id, sku, is_parent FROM products WHERE id = ANY($1::uuid[]) FOR UPDATE',
        [[sourceId, targetId]]
      );
      const source = locked.find((p) => p.id === sourceId);
      const target = locked.find((p) => p.id === targetId);
      if (!source || !target) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Producto origen o destino no encontrado' });
      }
      if (source.is_parent || target.is_parent) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'Solo se pueden fusionar variantes, no productos padre' });
      }

      // 1. Líneas de pedido: todo lo que siga apuntando al origen sigue descontado.
      const { rows: oi } = await client.query(
        `SELECT COALESCE(SUM(quantity), 0)::int AS reserved, count(*)::int AS rows
           FROM order_items
          WHERE product_id = $1 AND kind = 'product'`,
        [sourceId]
      );
      await client.query('UPDATE order_items SET product_id = $1 WHERE product_id = $2', [
        targetId,
        sourceId,
      ]);

      // 2. Ítems de OT: solo las completadas llegaron a sumar stock.
      const { rows: woi } = await client.query(
        `SELECT COALESCE(SUM(woi.quantity_to_produce), 0)::int AS produced
           FROM work_order_items woi
           JOIN work_orders wo ON wo.id = woi.work_order_id
          WHERE woi.product_id = $1 AND wo.status = 'completed'`,
        [sourceId]
      );
      const { rowCount: woiMoved } = await client.query(
        'UPDATE work_order_items SET product_id = $1 WHERE product_id = $2',
        [targetId, sourceId]
      );

      // 3. Devoluciones: cada 'restocked' sumó una unidad.
      const { rows: ret } = await client.query(
        `SELECT count(*) FILTER (WHERE resolution_status = 'restocked')::int AS restocked,
                count(*)::int AS rows
           FROM returns WHERE product_id = $1`,
        [sourceId]
      );
      await client.query('UPDATE returns SET product_id = $1 WHERE product_id = $2', [
        targetId,
        sourceId,
      ]);

      // 4. El efecto neto que esas filas tienen hoy sobre el stock del origen.
      const delta = woi[0].produced + ret[0].restocked - oi[0].reserved;
      if (delta !== 0) {
        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
          delta,
          sourceId,
        ]);
        await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [
          delta,
          targetId,
        ]);
      }

      // 5. product_materials, product_processes, shopify_sync_errors y el bridge de BOM
      //    son ON DELETE CASCADE.
      await client.query('DELETE FROM products WHERE id = $1', [sourceId]);

      await client.query('COMMIT');

      await tryPushInventory(targetId);

      res.json({
        ok: true,
        moved: {
          order_items: oi[0].rows,
          work_order_items: woiMoved ?? 0,
          returns: ret[0].rows,
        },
        stock_delta: delta,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

productsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM products WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

/** Bulk delete: body = { ids: string[] } */
productsRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.json({ deleted: 0 });
    const { rowCount } = await pool.query(
      'DELETE FROM products WHERE id = ANY($1::uuid[])',
      [ids]
    );
    res.json({ deleted: rowCount });
  })
);
