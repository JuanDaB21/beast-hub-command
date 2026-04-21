import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert, buildUpdate, pickBody } from '../util';

const COLS = [
  'supplier_id',
  'category_id',
  'subcategory_id',
  'color_id',
  'size_id',
  'sku',
  'name',
  'unit_price',
  'unit_of_measure',
  'stock',
] as const;

const SELECT_WITH_RELATIONS = `
  SELECT
    rm.*,
    CASE WHEN s.id IS NOT NULL
      THEN json_build_object('id', s.id, 'name', s.name, 'contact_phone', s.contact_phone)
      ELSE NULL END AS supplier,
    CASE WHEN c.id IS NOT NULL
      THEN json_build_object('id', c.id, 'name', c.name)
      ELSE NULL END AS category,
    CASE WHEN sc.id IS NOT NULL
      THEN json_build_object('id', sc.id, 'category_id', sc.category_id, 'name', sc.name)
      ELSE NULL END AS subcategory,
    CASE WHEN co.id IS NOT NULL
      THEN json_build_object('id', co.id, 'name', co.name, 'hex_code', co.hex_code)
      ELSE NULL END AS color,
    CASE WHEN sz.id IS NOT NULL
      THEN json_build_object('id', sz.id, 'label', sz.label, 'sort_order', sz.sort_order)
      ELSE NULL END AS size
  FROM raw_materials rm
  LEFT JOIN suppliers s ON s.id = rm.supplier_id
  LEFT JOIN categories c ON c.id = rm.category_id
  LEFT JOIN subcategories sc ON sc.id = rm.subcategory_id
  LEFT JOIN colors co ON co.id = rm.color_id
  LEFT JOIN sizes sz ON sz.id = rm.size_id
`;

function normalizeNames(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') return [raw];
  return [];
}

export const rawMaterialsRouter = Router();

rawMaterialsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const supplierId = req.query.supplier_id as string | undefined;
    const categoryId = req.query.category_id as string | undefined;
    const names = normalizeNames(req.query.names ?? req.query['names[]']);

    // Specialized lookup: findExistingVariantNames
    if (supplierId && categoryId && names.length > 0) {
      const { rows } = await pool.query(
        'SELECT name FROM raw_materials WHERE supplier_id = $1 AND category_id = $2 AND name = ANY($3::text[])',
        [supplierId, categoryId, names]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      `${SELECT_WITH_RELATIONS} ORDER BY rm.created_at DESC`
    );
    res.json(rows);
  })
);

rawMaterialsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    // Bulk insert if body is array
    if (Array.isArray(req.body)) {
      if (req.body.length === 0) return res.json([]);
      const inserted: any[] = [];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const item of req.body) {
          const { sql, params } = buildInsert('raw_materials', COLS, item);
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

    const { sql, params } = buildInsert('raw_materials', COLS, req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

rawMaterialsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildUpdate('raw_materials', COLS, req.body, String(req.params.id));
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);

/** Bulk patch: body = { ids: string[], patch: {...} } */
rawMaterialsRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const picked = pickBody(req.body?.patch ?? {}, COLS);
    const keys = Object.keys(picked);
    if (ids.length === 0 || keys.length === 0) {
      return res.status(400).json({ error: 'ids y patch requeridos' });
    }
    const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const sql = `UPDATE raw_materials SET ${setSql} WHERE id = ANY($${keys.length + 1}::uuid[]) RETURNING id`;
    const params = [...keys.map((k) => (picked as any)[k]), ids];
    const { rows } = await pool.query(sql, params);
    res.json({ updated: rows.length });
  })
);

rawMaterialsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM raw_materials WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

/** Bulk delete: body = { ids: string[] } */
rawMaterialsRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.json({ deleted: 0 });
    const { rowCount } = await pool.query(
      'DELETE FROM raw_materials WHERE id = ANY($1::uuid[])',
      [ids]
    );
    res.json({ deleted: rowCount });
  })
);
