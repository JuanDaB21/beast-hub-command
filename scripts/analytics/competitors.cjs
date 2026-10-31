// Precios de la competencia por tipo de prenda vía el endpoint público de Shopify /products.json (solo GET).
// Uso: node scripts/analytics/competitors.cjs beastclub.store invictowear.com [otro.dominio ...]
// El primer dominio es la referencia (Beast Club). Detalle en scripts/analytics/.out/competitors.json.
const fs = require('fs');
const path = require('path');

const DOMAINS = process.argv.slice(2);
const OUT = path.join(__dirname, '.out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const k = (n) => (n == null ? '-' : `${(n / 1000).toFixed(1)}k`);

// El orden importa: lo más específico primero.
const TYPES = [
  ['Conjunto', /conjunto|\bset\b/i],
  ['Compresión', /compres/i],
  ['Hoodie', /hoodie|buzo|saco|chaqueta|sweater/i],
  ['Jogger', /jogger|sudadera|pantal[oó]n|legging|licra/i],
  ['Short', /short|pantaloneta|bermuda/i],
  ['Tank', /tank|esqueleto|musculosa|sin manga|stringer|top\b/i],
  ['Camiseta', /camiseta|tee|shirt|oversize|polo|crop/i],
];
const typeOf = (p) => (TYPES.find(([, re]) => re.test(`${p.product_type} ${p.title}`)) || ['Otro'])[0];
const q = (arr, f) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(f * arr.length))] : null);

async function products(domain) {
  const out = [];
  for (let page = 1; page <= 6; page++) {
    const r = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) break;
    const batch = (await r.json()).products || [];
    out.push(...batch);
    if (batch.length < 250) break;
    await sleep(1000);
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const result = {};
  for (const d of DOMAINS) {
    try {
      const ps = await products(d);
      const rows = ps.map((p) => {
        const avail = p.variants.filter((v) => v.available);
        const price = Math.min(...p.variants.map((v) => +v.price));
        const cmp = Math.max(0, ...p.variants.map((v) => +v.compare_at_price || 0));
        return { title: p.title, type: typeOf(p), price, compareAt: cmp > price ? cmp : null, available: avail.length > 0 };
      }).filter((x) => x.available && x.price > 0);
      result[d] = rows;
      console.log(`${d}: ${ps.length} productos, ${rows.length} con stock, ${rows.filter((x) => x.compareAt).length} con precio tachado`);
    } catch (e) {
      console.log(`${d}: ERR ${e.message.slice(0, 80)}`);
    }
  }
  const types = [...new Set(Object.values(result).flatMap((rows) => rows.map((x) => x.type)))];
  console.log('\nTIPO | dominio | n | p25 | mediana | p75 | % tachado');
  for (const t of types) {
    for (const [d, rows] of Object.entries(result)) {
      const ps = rows.filter((x) => x.type === t).map((x) => x.price).sort((a, b) => a - b);
      if (!ps.length) continue;
      const disc = rows.filter((x) => x.type === t && x.compareAt).length / ps.length;
      console.log(`${t} | ${d} | ${ps.length} | ${k(q(ps, 0.25))} | ${k(q(ps, 0.5))} | ${k(q(ps, 0.75))} | ${(disc * 100).toFixed(0)}%`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'competitors.json'), JSON.stringify({ generated: new Date().toISOString(), result }, null, 2));
})();
