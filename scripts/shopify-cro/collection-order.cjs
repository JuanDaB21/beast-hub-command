// Ordena las colecciones de collection-order.json. Dos estrategias por colección:
//   sales  (defecto): pins del anuncio → vendidos (≥50 % tallas, por unidades) → nuevos sin historial (tras los
//                     primeros `new_after`) → resto por unidades → pocas tallas → agotados → packs.
//   newest:           pins → disponibles por fecha de creación (lo más reciente primero) → pocas tallas → agotados → packs.
// Shopify pone al FINAL de una colección manual cada producto nuevo: correr --apply tras cada lanzamiento o reactivación.
//   node scripts/shopify-cro/collection-order.cjs                    → dry-run (top 12 antes/después)
//   node scripts/shopify-cro/collection-order.cjs --apply            → guarda el orden previo en .out/ y reordena
//   node scripts/shopify-cro/collection-order.cjs [--apply] --only h1,h2   → solo esas colecciones
const fs = require('fs');
const path = require('path');
const { gql, paginate } = require('./shopifyCro.cjs');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'collection-order.json'), 'utf8'));
const APPLY = process.argv.includes('--apply');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const OUT = path.join(__dirname, '.out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function unitsByTitle() {
  const q = `FROM sales SHOW net_items_sold GROUP BY product_title SINCE -${cfg.sales_days}d UNTIL today ORDER BY net_items_sold DESC LIMIT 1000`;
  const r = (await gql('query($q:String!){shopifyqlQuery(query:$q){parseErrors tableData{rows}}}', { q })).shopifyqlQuery;
  if (r.parseErrors?.length) throw new Error(`ShopifyQL: ${JSON.stringify(r.parseErrors)}`);
  return Object.fromEntries(r.tableData.rows.map((x) => [x.product_title, +x.net_items_sold || 0]));
}

async function load(handle) {
  const c = (await gql(`query($h:String!){collectionByHandle(handle:$h){id sortOrder}}`, { h: handle })).collectionByHandle;
  if (!c) throw new Error(`colección ${handle} no existe`);
  const products = await paginate(
    `query($after:String){collection(id:"${c.id}"){products(first:100,after:$after){pageInfo{hasNextPage endCursor}
      nodes{id title handle createdAt productType variants(first:100){nodes{availableForSale}}}}}}`,
    (d) => d.collection.products,
  );
  return { ...c, products };
}

function desiredOrder(products, opts, units) {
  const { pin: pins = [], strategy = 'sales' } = opts;
  const newAfter = opts.new_after ?? cfg.new_after;
  const now = Date.now();
  const rows = products.map((p, i) => {
    const v = p.variants.nodes;
    const avail = v.length ? v.filter((x) => x.availableForSale).length / v.length : 0;
    return { ...p, pos: i, u: units[p.title] || 0, avail, isNew: now - Date.parse(p.createdAt) < cfg.new_days * 864e5, isPack: /pack/i.test(p.productType) };
  });
  const byUnits = (a, b) => b.u - a.u || a.pos - b.pos;
  const byNewest = (a, b) => b.createdAt.localeCompare(a.createdAt);
  const pinned = pins.map((h) => rows.find((r) => r.handle === h)).filter(Boolean);
  const packs = rows.filter((r) => r.isPack && !pinned.includes(r)).sort((a, b) => a.pos - b.pos);
  const rest = rows.filter((r) => !pinned.includes(r) && !r.isPack);
  const ok = rest.filter((r) => r.avail >= 0.5);
  const low = rest.filter((r) => r.avail > 0 && r.avail < 0.5);
  const soldOut = rest.filter((r) => r.avail === 0).sort((a, b) => a.pos - b.pos);
  let body;
  if (strategy === 'newest') {
    body = [...ok.sort(byNewest), ...low.sort(byNewest)];
  } else {
    const sellers = ok.filter((r) => r.u > 0).sort(byUnits);
    const fresh = ok.filter((r) => r.u === 0 && r.isNew).sort(byNewest);
    const others = ok.filter((r) => r.u === 0 && !r.isNew).sort(byUnits);
    body = [...sellers.slice(0, newAfter), ...fresh, ...sellers.slice(newAfter), ...others, ...low.sort(byUnits)];
  }
  return { rows, order: [...pinned, ...body, ...soldOut, ...packs], missing: pins.filter((h) => !pinned.some((r) => r.handle === h)) };
}

const label = (r) => `${r.title.replace(/\s+(Training|Oversized|-).*$/i, '').slice(0, 22)}(${r.u}u${r.avail === 0 ? ',agot' : r.avail < 0.5 ? ',pocas' : ''}${r.isNew && !r.u ? ',nuevo' : ''}${r.isPack ? ',pack' : ''})`;
const share = (list, total) => (total ? `${Math.round((100 * list.slice(0, 12).reduce((s, r) => s + r.u, 0)) / total)}%` : '-');

async function reorder(c, order) {
  if (c.sortOrder !== 'MANUAL') {
    const r = await gql('mutation($input:CollectionInput!){collectionUpdate(input:$input){userErrors{message}}}', { input: { id: c.id, sortOrder: 'MANUAL' } });
    if (r.collectionUpdate.userErrors.length) throw new Error(JSON.stringify(r.collectionUpdate.userErrors));
  }
  const moves = order.map((r, i) => ({ id: r.id, newPosition: String(i) }));
  for (let i = 0; i < moves.length; i += 250) {
    const r = await gql('mutation($id:ID!,$moves:[MoveInput!]!){collectionReorderProducts(id:$id,moves:$moves){job{id done} userErrors{message}}}', { id: c.id, moves: moves.slice(i, i + 250) });
    const { job, userErrors } = r.collectionReorderProducts;
    if (userErrors.length) throw new Error(JSON.stringify(userErrors));
    for (let t = 0; job && !job.done && t < 30; t++) {
      await sleep(2000);
      if ((await gql('query($id:ID!){job(id:$id){done}}', { id: job.id })).job.done) break;
    }
  }
}

(async () => {
  const units = await unitsByTitle();
  const backupFile = path.join(OUT, `collection-order-${new Date().toISOString().slice(0, 10)}.json`);
  // Acumula sobre el respaldo del día: si se corre dos veces, conserva el orden ANTERIOR a la primera corrida.
  const backup = fs.existsSync(backupFile) ? JSON.parse(fs.readFileSync(backupFile, 'utf8')) : {};
  for (const [handle, opts] of Object.entries(cfg.collections)) {
    if (ONLY && !ONLY.includes(handle)) continue;
    const c = await load(handle);
    const { rows, order, missing } = desiredOrder(c.products, opts, units);
    const total = rows.reduce((s, r) => s + r.u, 0);
    console.log(`\n== ${handle} [${opts.strategy || 'sales'}]${opts.ads ? ` (${opts.ads})` : ''} · ${rows.length} productos · orden ${c.sortOrder} · ventas ${cfg.sales_days} d en top 12: ${share(rows, total)} → ${share(order, total)}`);
    if (missing.length) console.log(`  ! pins fuera de la colección: ${missing.join(', ')}`);
    console.log(`  antes:   ${rows.slice(0, 12).map(label).join(' · ')}`);
    console.log(`  después: ${order.slice(0, 12).map(label).join(' · ')}`);
    if (!APPLY) continue;
    backup[handle] ??= { sortOrder: c.sortOrder, handles: rows.map((r) => r.handle) };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    await reorder(c, order);
    console.log('  ✓ reordenada');
  }
  if (!APPLY) console.log('\n(dry-run: nada cambió; usar --apply)');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
