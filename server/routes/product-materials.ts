import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const SELECT_WITH_RM = `
  SELECT
    pm.id, pm.product_id, pm.raw_material_id, pm.quantity_required,
    json_build_object(
      'id', rm.id, 'name', rm.name, 'sku', rm.sku,
      'stock', rm.stock, 'unit_of_measure', rm.unit_of_measure,
      'supplier_id', rm.supplier_id,
      'unit_price', rm.unit_price
    ) AS raw_material
  FROM product_materials pm
  JOIN raw_materials rm ON rm.id = pm.raw_material_id
`;

export const productMaterialsRouter = Router();

/**
 * GET /api/product-materials
 *   ?product_id=<id>  -> BOM for single product
 *   ?product_ids=a,b,c -> BOM for multiple products
 */
productMaterialsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const productId = req.query.product_id as string | undefined;
    const productIds = req.query.product_ids as string | undefined;

    if (productId) {
      const { rows } = await pool.query(
        `${SELECT_WITH_RM} WHERE pm.product_id = $1`,
        [productId]
      );
      return res.json(rows);
    }
    if (productIds) {
      const ids = productIds.split(',').filter(Boolean);
      if (ids.length === 0) return res.json([]);
      const { rows } = await pool.query(
        `${SELECT_WITH_RM} WHERE pm.product_id = ANY($1::uuid[])`,
        [ids]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(SELECT_WITH_RM);
    res.json(rows);
  })
);

/**
 * POST /api/product-materials
 * Body: { product_id, raw_material_id, quantity_required }
 * Upserts on (product_id, raw_material_id).
 * Also accepts array for bulk insert.
 */
productMaterialsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (Array.isArray(req.body)) {
      if (req.body.length === 0) return res.json([]);
      const client = await pool.connect();
      const inserted: any[] = [];
      try {
        await client.query('BEGIN');
        for (const it of req.body) {
          const { rows } = await client.query(
            `INSERT INTO product_materials (product_id, raw_material_id, quantity_required)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, raw_material_id)
             DO UPDATE SET quantity_required = EXCLUDED.quantity_required
             RETURNING *`,
            [it.product_id, it.raw_material_id, it.quantity_required]
          );
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

    const { product_id, raw_material_id, quantity_required } = req.body ?? {};
    if (!product_id || !raw_material_id || quantity_required === undefined) {
      return res
        .status(400)
        .json({ error: 'product_id, raw_material_id, quantity_required requeridos' });
    }
    const { rows } = await pool.query(
      `INSERT INTO product_materials (product_id, raw_material_id, quantity_required)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, raw_material_id)
       DO UPDATE SET quantity_required = EXCLUDED.quantity_required
       RETURNING *`,
      [product_id, raw_material_id, quantity_required]
    );
    res.status(201).json(rows[0]);
  })
);

productMaterialsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM product_materials WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  })
);

/** Bulk delete by product_ids: body = { product_ids: string[] } */
productMaterialsRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const productIds: string[] = Array.isArray(req.body?.product_ids)
      ? req.body.product_ids
      : [];
    if (productIds.length === 0) return res.json({ deleted: 0 });
    const { rowCount } = await pool.query(
      'DELETE FROM product_materials WHERE product_id = ANY($1::uuid[])',
      [productIds]
    );
    res.json({ deleted: rowCount });
  })
);
