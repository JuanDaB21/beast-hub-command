import bcrypt from 'bcryptjs';
import { pool } from './db';

async function run() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required');
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email.toLowerCase().trim(), password_hash, name]
    );

    if (rows.length === 0) {
      console.log(`User ${email} already exists, nothing to do.`);
    } else {
      console.log(`Admin user ${email} created (id: ${rows[0].id})`);
    }
  } catch (err) {
    console.error('Failed to create admin user:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
