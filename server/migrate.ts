import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pool } from './db';

function resolveMigrationsDir(): string {
  const candidates = [
    join(__dirname, 'migrations'),
    join(process.cwd(), 'server', 'migrations'),
    join(process.cwd(), 'dist', 'server', 'migrations'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      const hasSql = readdirSync(dir).some((f) => f.endsWith('.sql'));
      if (hasSql) return dir;
    }
  }
  throw new Error(
    `No migrations directory found. Looked in: ${candidates.join(', ')}`
  );
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function applied(): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations'
  );
  return new Set(rows.map((r) => r.filename));
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const done = await applied();
  const dir = resolveMigrationsDir();

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`- skip ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    console.log(`> applying ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ok ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
