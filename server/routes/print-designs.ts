import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert, buildUpdate } from '../util';

const COLS = [
  'name',
  'hex_code',
  'ink_raw_material_id',
  'ink_grams_per_cm',
  'active',
] as const;

const SELECT_WITH_RM = `
  SELECT
    pd.*,
    CASE WHEN rm.id IS NOT NULL
      THEN json_build_object(
        'id', rm.id, 'name', rm.name, 'sku', rm.sku,
        'stock', rm.stock, 'unit_of_measure', rm.unit_of_measure
      )
      ELSE NULL END AS ink_raw_material
  FROM print_designs pd
  LEFT JOIN raw_materials rm ON rm.id = pd.ink_raw_material_id
`;

export const printDesignsRouter = Router();

printDesignsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const active = req.query.active;
    const where = active === 'true' ? 'WHERE pd.active = true'
      : active === 'false' ? 'WHERE pd.active = false'
      : '';
    const { rows } = await pool.query(
      `${SELECT_WITH_RM} ${where} ORDER BY pd.name`
    );
    res.json(rows);
  })
);

printDesignsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (Array.isArray(req.body)) {
      if (req.body.length === 0) return res.json([]);
      const client = await pool.connect();
      const inserted: unknown[] = [];
      try {
        await client.query('BEGIN');
        for (const item of req.body) {
          const { sql, params } = buildInsert('print_designs', COLS, item);
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
    const { sql, params } = buildInsert('print_designs', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

printDesignsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildUpdate('print_designs', COLS, req.body, String(req.params.id));
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

printDesignsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM print_designs WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

printDesignsRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.json({ deleted: 0 });
    const { rowCount } = await pool.query(
      'DELETE FROM print_designs WHERE id = ANY($1::uuid[])',
      [ids]
    );
    res.json({ deleted: rowCount });
  })
);
