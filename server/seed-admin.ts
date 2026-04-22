import bcrypt from 'bcryptjs';
import { pool } from './db';

const DEFAULT_ADMIN_EMAIL = 'admin@beasthub.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_ADMIN_NAME = 'Admin';

export async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? DEFAULT_ADMIN_NAME;

  const usingDefaults =
    !process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD;
  if (usingDefaults) {
    console.warn(
      `[seed-admin] Using default admin credentials (${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}) — cambiar por seguridad.`
    );
  }

  const password_hash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, password_hash, name]
    );

    if (rows.length === 0) {
      console.log(`[seed-admin] User ${email} already exists, skipping.`);
    } else {
      console.log(`[seed-admin] Admin user ${email} created (id: ${rows[0].id})`);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedAdmin()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
