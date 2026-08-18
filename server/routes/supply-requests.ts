import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

/**
 * Marcador de las solicitudes generadas por el flujo unificado (suma de todos
 * los lotes activos). Distinto del marcador del flujo por-borrador para que no
 * se pisen entre sí.
 */
const UNIFIED_NOTE = 'Solicitud unificada de bases (producción)';

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

interface UnifiedSupplierGroup {
  supplier_id: string;
  supplier_name: string | null;
  total_units: number;
  items: Array<{ raw_material_id: string; name: string; quantity_requested: number }>;
}

interface UnifiedSupplyResult {
  request_ids: string[];
  created: number;
  updated: number;
  total_units: number;
  suppliers: UnifiedSupplierGroup[];
}

/**
 * POST /from-active-lots — recalcula la necesidad total de bases sumando TODOS
 * los lotes activos (in_progress + pending), resta el stock una sola vez,
 * aplica el margen del 20% y escribe UNA solicitud `pending` unificada por
 * proveedor con semántica SET (reemplazo total de items) → idempotente.
 * No toca solicitudes partial/confirmed/delivered.
 */
supplyRequestsRouter.post(
  '/from-active-lots',
  asyncHandler(async (_req, res) => {
    // 1. Agregar la necesidad total por base sumando todos los lotes activos.
    const { rows: needs } = await pool.query(
      `SELECT pm.raw_material_id, rm.supplier_id, rm.name, rm.stock,
              SUM(pm.quantity_required * woi.quantity_to_produce) AS required
       FROM work_orders wo
       JOIN work_order_items woi ON woi.work_order_id = wo.id
       JOIN product_materials  pm  ON pm.product_id = woi.product_id
       JOIN raw_materials      rm  ON rm.id = pm.raw_material_id
       WHERE wo.status IN ('in_progress','pending')
       GROUP BY pm.raw_material_id, rm.supplier_id, rm.name, rm.stock`
    );

    // 2. missing = max(0, required - stock); descartar sin faltante o sin proveedor.
    const bySupplier = new Map<
      string,
      Array<{ raw_material_id: string; name: string; qty: number }>
    >();
    for (const n of needs as Array<{
      raw_material_id: string;
      supplier_id: string | null;
      name: string;
      stock: string;
      required: string;
    }>) {
      if (!n.supplier_id) continue;
      const missing = Math.max(0, Number(n.required) - Number(n.stock));
      if (missing <= 0) continue;
      const qty = Math.ceil(missing * 1.2);
      const list = bySupplier.get(n.supplier_id) ?? [];
      list.push({ raw_material_id: n.raw_material_id, name: n.name, qty });
      bySupplier.set(n.supplier_id, list);
    }

    const result: UnifiedSupplyResult = {
      request_ids: [],
      created: 0,
      updated: 0,
      total_units: 0,
      suppliers: [],
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [supplier_id, items] of bySupplier) {
        // Reutilizar solo una solicitud pending de ESTE flujo (marcador propio).
        const { rows: existingRows } = await client.query(
          `SELECT id FROM supply_requests
           WHERE supplier_id = $1 AND status = 'pending' AND notes = $2
           ORDER BY created_at DESC LIMIT 1`,
          [supplier_id, UNIFIED_NOTE]
        );

        let requestId: string;
        if (existingRows[0]) {
          requestId = existingRows[0].id;
          result.updated += 1;
          // SET: borrar items previos y reescribir el total actual.
          await client.query(
            `DELETE FROM supply_request_items WHERE supply_request_id = $1`,
            [requestId]
          );
        } else {
          const { rows: createdRows } = await client.query(
            `INSERT INTO supply_requests (supplier_id, status, notes)
             VALUES ($1, 'pending', $2)
             RETURNING id`,
            [supplier_id, UNIFIED_NOTE]
          );
          requestId = createdRows[0].id;
          result.created += 1;
        }

        let supplierUnits = 0;
        for (const it of items) {
          await client.query(
            `INSERT INTO supply_request_items (supply_request_id, raw_material_id, quantity_requested)
             VALUES ($1, $2, $3)`,
            [requestId, it.raw_material_id, it.qty]
          );
          supplierUnits += it.qty;
          result.total_units += it.qty;
        }

        const { rows: supRows } = await client.query(
          `SELECT name FROM suppliers WHERE id = $1`,
          [supplier_id]
        );

        result.request_ids.push(requestId);
        result.suppliers.push({
          supplier_id,
          supplier_name: supRows[0]?.name ?? null,
          total_units: supplierUnits,
          items: items.map((i) => ({
            raw_material_id: i.raw_material_id,
            name: i.name,
            quantity_requested: i.qty,
          })),
        });
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
