// Cliente mínimo Admin GraphQL para el plan CRO (app "Beast CRO" del Dev Dashboard).
// Credenciales en .env.local: SHOPIFY_CRO_SHOP, SHOPIFY_CRO_CLIENT_ID, SHOPIFY_CRO_CLIENT_SECRET.
// El token sale de client credentials (dura 24 h) y se pide una vez por proceso.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const SHOP = env.SHOPIFY_CRO_SHOP;
const API_VERSION = env.SHOPIFY_CRO_API_VERSION || '2026-07';
if (!SHOP || !env.SHOPIFY_CRO_CLIENT_ID || !env.SHOPIFY_CRO_CLIENT_SECRET) {
  throw new Error('Faltan SHOPIFY_CRO_SHOP / SHOPIFY_CRO_CLIENT_ID / SHOPIFY_CRO_CLIENT_SECRET en .env.local');
}

let tokenPromise = null;
function getToken() {
  tokenPromise ??= fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.SHOPIFY_CRO_CLIENT_ID,
      client_secret: env.SHOPIFY_CRO_CLIENT_SECRET,
    }),
  }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(`Token ${r.status}: ${JSON.stringify(j)}`);
    return j;
  });
  return tokenPromise;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(query, variables = {}) {
  const { access_token } = await getToken();
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': access_token },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json();
    const throttled = j.errors?.some?.((e) => e.extensions?.code === 'THROTTLED');
    if ((r.status === 429 || throttled) && attempt < 5) { await sleep(1000 * (attempt + 1)); continue; }
    if (!r.ok || j.errors) throw new Error(`GraphQL ${r.status}: ${JSON.stringify(j.errors ?? j)}`);
    return j.data;
  }
}

// Itera una conexión paginada: `pick(data)` devuelve { nodes, pageInfo }.
async function paginate(query, pick, variables = {}) {
  const out = [];
  let after = null;
  do {
    const conn = pick(await gql(query, { ...variables, after }));
    out.push(...conn.nodes);
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (after);
  return out;
}

module.exports = { gql, paginate, getToken, SHOP, API_VERSION, ROOT };
