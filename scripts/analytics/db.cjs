// Conexión de solo lectura a la BD de producción (Railway `carefree-love` → Postgres).
// La URL se lee del CLI de Railway dentro del proceso y nunca se imprime.
const { execSync } = require('child_process');
const { Client } = require('pg');

function dbUrl() {
  const vars = JSON.parse(execSync('railway variables --service Postgres --json', { encoding: 'utf8' }));
  return vars.DATABASE_PUBLIC_URL;
}

// Ejecuta fn(q) dentro de BEGIN READ ONLY; q(sql, params) devuelve rows.
async function readOnly(fn) {
  const client = new Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    return await fn((sql, params) => client.query(sql, params).then((r) => r.rows));
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

module.exports = { readOnly };
