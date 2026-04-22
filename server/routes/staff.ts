import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { asyncHandler } from '../util';

export const staffRouter = Router();

staffRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, active, created_at FROM profiles ORDER BY created_at DESC`
    );
    res.json(rows);
  })
);

interface NewStaffBody {
  full_name: string;
  email: string;
  password: string;
}

/**
 * POST / — crea un usuario con password hasheada.
 * El trigger handle_new_user() de users → profiles ya inserta el profile automáticamente,
 * luego se actualiza full_name explícitamente.
 */
staffRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { full_name, email, password } = req.body as NewStaffBody;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'full_name, email y password requeridos' });
    }

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing[0]) return res.status(409).json({ error: 'Email ya registrado' });

    const password_hash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: userRows } = await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, 'staff') RETURNING id`,
        [email, password_hash, full_name]
      );
      const userId = userRows[0].id;
      // handle_new_user trigger inserts profile; ensure full_name/email are set.
      await client.query(
        `UPDATE profiles SET full_name = $1, email = $2 WHERE id = $3`,
        [full_name, email, userId]
      );
      await client.query('COMMIT');
      res.status(201).json({ id: userId, full_name, email });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

staffRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const sets: string[] = [];
    const params: unknown[] = [];
    if (typeof req.body.full_name === 'string') {
      params.push(req.body.full_name);
      sets.push(`full_name = $${params.length}`);
    }
    if (typeof req.body.active === 'boolean') {
      params.push(req.body.active);
      sets.push(`active = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE profiles SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);
