import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUEST_QUERY = `
  SELECT sr.id, sr.status, sr.notes, sr.created_at, sr.updated_at, sr.supplier_id,
    CASE WHEN sup.id IS NOT NULL
      THEN json_build_object('id', sup.id, 'name', sup.name, 'contact_phone', sup.contact_phone)
      ELSE NULL END AS supplier,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', si.id,
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
  FROM supply_requests sr
  LEFT JOIN suppliers sup ON sup.id = sr.supplier_id
  WHERE sr.secure_token = $1
`;

export const supplierPortalRouter = Router();

/** GET /?token=<uuid> — devuelve la solicitud completa. Público. */
supplierPortalRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const token = (req.query.token as string | undefined) ?? '';
    if (!token || !UUID_RE.test(token)) {
      return res.status(400).json({ error: 'Token inválido' });
    }
    const { rows } = await pool.query(REQUEST_QUERY, [token]);
    if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ request: rows[0] });
  })
);

interface PostBody {
  token?: string;
  items?: Array<{ id: string; quantity_confirmed: number; is_available: boolean }>;
  notes?: string;
}

/** POST — recibe confirmación del proveedor y recalcula status. Público. */
supplierPortalRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as PostBody;
    if (!body?.token || !UUID_RE.test(body.token)) {
      return res.status(400).json({ error: 'Token inválido' });
    }
    if (!Array.isArray(body.items)) {
      return res.status(400).json({ error: 'Items inválidos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: reqRows } = await client.query(
        'SELECT id, status FROM supply_requests WHERE secure_token = $1',
        [body.token]
      );
      const request = reqRows[0];
      if (!request) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }
      if (request.status === 'delivered') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Esta solicitud ya fue entregada' });
      }

      const { rows: existing } = await client.query(
        'SELECT id FROM supply_request_items WHERE supply_request_id = $1',
        [request.id]
      );
      const validIds = new Set<string>(existing.map((r: { id: string }) => r.id));

      for (const it of body.items) {
        if (!validIds.has(it.id)) continue;
        const qty = Math.max(0, Number(it.quantity_confirmed) || 0);
        const available = !!it.is_available;
        await client.query(
          `UPDATE supply_request_items
           SET quantity_confirmed = $1, is_available = $2
           WHERE id = $3 AND supply_request_id = $4`,
          [available ? qty : 0, available, it.id, request.id]
        );
      }

      const { rows: refreshed } = await client.query(
        `SELECT quantity_requested, quantity_confirmed, is_available
         FROM supply_request_items WHERE supply_request_id = $1`,
        [request.id]
      );

      let nextStatus: 'pending' | 'partial' | 'confirmed' = 'pending';
      if (refreshed.length > 0) {
        const allFull = refreshed.every(
          (i: { quantity_requested: string; quantity_confirmed: string; is_available: boolean }) =>
            i.is_available &&
            Number(i.quantity_confirmed) >= Number(i.quantity_requested) &&
            Number(i.quantity_requested) > 0
        );
        const anyConfirmed = refreshed.some(
          (i: { quantity_confirmed: string; is_available: boolean }) =>
            i.is_available && Number(i.quantity_confirmed) > 0
        );
        if (allFull) nextStatus = 'confirmed';
        else if (anyConfirmed) nextStatus = 'partial';
      }

      const params: unknown[] = [nextStatus];
      let sql = 'UPDATE supply_requests SET status = $1, updated_at = now()';
      if (typeof body.notes === 'string') {
        params.push(body.notes);
        sql += `, notes = $${params.length}`;
      }
      params.push(request.id);
      sql += ` WHERE id = $${params.length}`;
      await client.query(sql, params);

      await client.query('COMMIT');
      res.json({ ok: true, status: nextStatus });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);
