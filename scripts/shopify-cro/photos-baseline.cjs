// Línea base / medición de las fichas con fotos nuevas: sesiones que aterrizan en la ficha, % que agrega al
// carrito y % que compra, por handle (ShopifyQL). Guarda .out/photos-baseline-<desde>_<hasta>.json.
//   node scripts/shopify-cro/photos-baseline.cjs [desde=-30d] [hasta=today]
const fs = require('fs');
const path = require('path');
const { gql } = require('./shopifyCro.cjs');
const plan = require('./photos-plan.json');

const [, , since = '-30d', until = 'today'] = process.argv;
(async () => {
  const handles = [...new Set(plan.products.map((p) => p.handle))];
  const q = `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_completed_checkout
    GROUP BY landing_page_path SINCE ${since} UNTIL ${until} ORDER BY sessions DESC LIMIT 1000`;
  const r = await gql(`query($q:String!){ shopifyqlQuery(query:$q){ parseErrors tableData{ columns{ name } rows } } }`, { q });
  const res = r.shopifyqlQuery;
  if (res.parseErrors?.length) throw new Error(JSON.stringify(res.parseErrors));
  const cols = res.tableData.columns.map((c) => c.name);
  const rows = res.tableData.rows.map((row) => (Array.isArray(row) ? Object.fromEntries(cols.map((c, i) => [c, row[i]])) : row));
  const out = {};
  for (const h of handles) {
    const hit = rows.filter((x) => String(x.landing_page_path || '').endsWith(`/products/${h}`));
    const s = hit.reduce((a, x) => a + Number(x.sessions || 0), 0);
    const atc = hit.reduce((a, x) => a + Number(x.sessions_with_cart_additions || 0), 0);
    const buy = hit.reduce((a, x) => a + Number(x.sessions_that_completed_checkout || 0), 0);
    out[h] = { sessions: s, atc, buy, atc_rate: s ? +(atc / s * 100).toFixed(1) : null, buy_rate: s ? +(buy / s * 100).toFixed(1) : null };
  }
  const file = path.join(__dirname, '.out', `photos-baseline-${since}_${until}.json`.replace(/[^\w.-]+/g, ''));
  fs.writeFileSync(file, JSON.stringify({ since, until, at: new Date().toISOString(), products: out }, null, 2));
  console.table(out);
  console.log(file);
})().catch((e) => { console.error(e.message); process.exit(1); });
