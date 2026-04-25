import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';
import { tryPushInventory } from '../lib/inventorySync';

const ITEMS_SUBQUERY = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', wi.id,
          'work_order_id', wi.work_order_id,
          'product_id', wi.product_id,
          'quantity_to_produce', wi.quantity_to_produce,
          'is_dtf_added', wi.is_dtf_added,
          'is_completed', wi.is_completed,
          'product', CASE WHEN p.id IS NOT NULL
            THEN json_build_object('id', p.id, 'sku', p.sku, 'name', p.name)
            ELSE NULL END
        )
        ORDER BY wi.created_at
      )
      FROM work_order_items wi
      LEFT JOIN products p ON p.id = wi.product_id
      WHERE wi.work_order_id = wo.id
    ),
    '[]'::json
  ) AS items
`;

export const workOrdersRouter = Router();

workOrdersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT wo.*, ${ITEMS_SUBQUERY}
       FROM work_orders wo
       ORDER BY wo.created_at DESC`
    );
    res.json(rows);
  })
);

function generateBatchNumber() {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LOT-${yyyymmdd}-${rand}`;
}

interface NewWorkOrderBody {
  notes?: string | null;
  target_date?: string | null;
  items: Array<{ product_id: string; quantity_to_produce: number }>;
}

workOrdersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as NewWorkOrderBody;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'Agrega al menos un producto al lote' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const batch_number = generateBatchNumber();
      const { rows: woRows } = await client.query(
        `INSERT INTO work_orders (batch_number, status, notes, target_date)
         VALUES ($1, 'pending', $2, $3)
         RETURNING *`,
        [batch_number, body.notes ?? null, body.target_date ?? null]
      );
      const wo = woRows[0];
      for (const it of body.items) {
        await client.query(
          `INSERT INTO work_order_items (work_order_id, product_id, quantity_to_produce)
           VALUES ($1, $2, $3)`,
          [wo.id, it.product_id, it.quantity_to_produce]
        );
      }
      await client.query('COMMIT');
      res.status(201).json(wo);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/** PATCH /:id — status update; sets started_at automatically on in_progress. */
workOrdersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { status } = req.body as { status?: string };
    if (!status) return res.status(400).json({ error: 'status requerido' });
    const sets: string[] = ['status = $1'];
    const params: unknown[] = [status];
    if (status === 'in_progress') {
      sets.push('started_at = now()');
    }
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE work_orders SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

workOrdersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM work_orders WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

/** POST /:id/complete — runs complete_work_order(_work_order_id) stored function. */
workOrdersRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await pool.query('SELECT complete_work_order($1)', [id]);
    // The stored fn bumps stock for every product in this work order's items.
    const { rows } = await pool.query<{ product_id: string }>(
      'SELECT DISTINCT product_id FROM work_order_items WHERE work_order_id = $1',
      [id]
    );
    for (const r of rows) await tryPushInventory(r.product_id);
    res.json({ ok: true });
  })
);

/** PATCH /items/:id — toggles is_dtf_added and/or is_completed. */
workOrdersRouter.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const sets: string[] = [];
    const params: unknown[] = [];
    if (typeof req.body.is_dtf_added === 'boolean') {
      params.push(req.body.is_dtf_added);
      sets.push(`is_dtf_added = $${params.length}`);
    }
    if (typeof req.body.is_completed === 'boolean') {
      params.push(req.body.is_completed);
      sets.push(`is_completed = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE work_order_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);
