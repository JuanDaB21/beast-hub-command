import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const ITEMS_SUBQUERY = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', si.id,
          'supply_request_id', si.supply_request_id,
          'raw_material_id', si.raw_material_id,
          'quantity_requested', si.quantity_requested,
          'quantity_confirmed', si.quantity_confirmed,
          'is_available', si.is_available,
          'raw_material', CASE WHEN rm.id IS NOT NULL
            THEN json_build_object(
              'id', rm.id, 'name', rm.name, 'sku', rm.sku,
              'unit_of_measure', rm.unit_of_measure
            )
            ELSE NULL END
        )
        ORDER BY si.created_at
      )
      FROM supply_request_items si
      LEFT JOIN raw_materials rm ON rm.id = si.raw_material_id
      WHERE si.supply_request_id = sr.id
    ),
    '[]'::json
  ) AS items
`;

const SUPPLIER_SUBQUERY = `
  CASE WHEN sup.id IS NOT NULL
    THEN json_build_object('id', sup.id, 'name', sup.name, 'contact_phone', sup.contact_phone)
    ELSE NULL END AS supplier
`;

export const supplyRequestsRouter = Router();

supplyRequestsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT sr.*, ${SUPPLIER_SUBQUERY}, ${ITEMS_SUBQUERY}
       FROM supply_requests sr
       LEFT JOIN suppliers sup ON sup.id = sr.supplier_id
       ORDER BY sr.created_at DESC`
    );
    res.json(rows);
  })
);

interface NewSupplyRequestBody {
  supplier_id: string;
  notes?: string | null;
  items: Array<{ raw_material_id: string; quantity_requested: number }>;
}

supplyRequestsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as NewSupplyRequestBody;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'Agrega al menos una base' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: srRows } = await client.query(
        `INSERT INTO supply_requests (supplier_id, notes, status)
         VALUES ($1, $2, 'pending')
         RETURNING *`,
        [body.supplier_id, body.notes ?? null]
      );
      const sr = srRows[0];
      for (const it of body.items) {
        await client.query(
          `INSERT INTO supply_request_items (supply_request_id, raw_material_id, quantity_requested)
           VALUES ($1, $2, $3)`,
          [sr.id, it.raw_material_id, it.quantity_requested]
        );
      }
      await client.query('COMMIT');
      res.status(201).json(sr);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

supplyRequestsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status) return res.status(400).json({ error: 'status requerido' });
    const { rows } = await pool.query(
      `UPDATE supply_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, String(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

supplyRequestsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM supply_requests WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

/** POST /:id/complete — runs complete_supply_request(_request_id) stored function. */
supplyRequestsRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    await pool.query('SELECT complete_supply_request($1)', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

interface ShortageInput {
  raw_material_id: string;
  supplier_id: string;
  missing: number;
}

interface AutoSupplyResult {
  request_ids: string[];
  created: number;
  updated: number;
  total_units: number;
}

/**
 * POST /auto-supply — given a list of shortages, groups them by supplier and
 * creates or extends a pending supply_request per supplier, upserting items
 * with a 20% safety margin (ceil(missing * 1.2)).
 */
supplyRequestsRouter.post(
  '/auto-supply',
  asyncHandler(async (req, res) => {
    const shortages = (req.body as ShortageInput[] | undefined) ?? [];
    if (!Array.isArray(shortages) || shortages.length === 0) {
      return res.status(400).json({ error: 'No hay faltantes que solicitar' });
    }

    const bySupplier = new Map<string, ShortageInput[]>();
    for (const s of shortages) {
      if (!s.supplier_id) continue;
      const list = bySupplier.get(s.supplier_id) ?? [];
      list.push(s);
      bySupplier.set(s.supplier_id, list);
    }

    const result: AutoSupplyResult = {
      request_ids: [],
      created: 0,
      updated: 0,
      total_units: 0,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [supplier_id, items] of bySupplier) {
        const { rows: existingRows } = await client.query(
          `SELECT id FROM supply_requests
           WHERE supplier_id = $1 AND status IN ('pending','partial')
           ORDER BY created_at DESC LIMIT 1`,
          [supplier_id]
        );

        let requestId: string;
        if (existingRows[0]) {
          requestId = existingRows[0].id;
          result.updated += 1;
        } else {
          const { rows: createdRows } = await client.query(
            `INSERT INTO supply_requests (supplier_id, status, notes)
             VALUES ($1, 'pending', 'Generada automáticamente desde producción')
             RETURNING id`,
            [supplier_id]
          );
          requestId = createdRows[0].id;
          result.created += 1;
        }
        result.request_ids.push(requestId);

        const { rows: existingItems } = await client.query(
          `SELECT id, raw_material_id, quantity_requested
           FROM supply_request_items WHERE supply_request_id = $1`,
          [requestId]
        );
        const byRm = new Map<string, { id: string; quantity_requested: number }>(
          existingItems.map((it: { id: string; raw_material_id: string; quantity_requested: string }) => [
            it.raw_material_id,
            { id: it.id, quantity_requested: Number(it.quantity_requested) },
          ])
        );

        for (const item of items) {
          const suggestedQty = Math.ceil(item.missing * 1.2);
          result.total_units += suggestedQty;
          const prev = byRm.get(item.raw_material_id);
          if (prev) {
            if (suggestedQty > prev.quantity_requested) {
              await client.query(
                `UPDATE supply_request_items SET quantity_requested = $1 WHERE id = $2`,
                [suggestedQty, prev.id]
              );
            }
          } else {
            await client.query(
              `INSERT INTO supply_request_items (supply_request_id, raw_material_id, quantity_requested)
               VALUES ($1, $2, $3)`,
              [requestId, item.raw_material_id, suggestedQty]
            );
          }
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json(result);
  })
);
