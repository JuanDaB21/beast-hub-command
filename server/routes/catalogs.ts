import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, buildInsert } from '../util';

export const catalogsRouter = Router();

/* ---------- CATEGORIES ---------- */
catalogsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  })
);

catalogsRouter.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'name requerido' });
    const { rows } = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(rows[0]);
  })
);

/* ---------- SUBCATEGORIES ---------- */
catalogsRouter.get(
  '/subcategories',
  asyncHandler(async (req, res) => {
    const categoryId = req.query.category_id as string | undefined;
    if (categoryId) {
      const { rows } = await pool.query(
        'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name',
        [categoryId]
      );
      res.json(rows);
    } else {
      const { rows } = await pool.query('SELECT * FROM subcategories ORDER BY name');
      res.json(rows);
    }
  })
);

catalogsRouter.post(
  '/subcategories',
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const category_id = req.body?.category_id;
    if (!name || !category_id) {
      return res.status(400).json({ error: 'name y category_id requeridos' });
    }
    const { rows } = await pool.query(
      'INSERT INTO subcategories (name, category_id) VALUES ($1, $2) RETURNING *',
      [name, category_id]
    );
    res.status(201).json(rows[0]);
  })
);

/* ---------- COLORS ---------- */
catalogsRouter.get(
  '/colors',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM colors ORDER BY name');
    res.json(rows);
  })
);

catalogsRouter.post(
  '/colors',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildInsert('colors', ['name', 'hex_code'], req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);

/* ---------- SIZES ---------- */
catalogsRouter.get(
  '/sizes',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM sizes ORDER BY sort_order');
    res.json(rows);
  })
);

catalogsRouter.post(
  '/sizes',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildInsert('sizes', ['label', 'sort_order'], req.body);
    const { rows } = await pool.query(sql, params);
    res.status(201).json(rows[0]);
  })
);
