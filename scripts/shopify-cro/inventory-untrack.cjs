// Pasa a "sin seguimiento de inventario" las prendas activas que hoy tienen stock (se producen bajo pedido).
// Alcance: productos ACTIVE, sin tipo Pack ni Compresión, con variantes rastreadas y stock > 0.
// Dentro de cada producto se liberan solo los COLORES con stock (todas sus tallas); un color en 0 en todas
// sus tallas sigue rastreado (agotado) hasta que se confirme que hay prenda base.
// Los packs/bundles no se tocan; se compara su disponibilidad antes y después.
// Uso: node scripts/shopify-cro/inventory-untrack.cjs            (dry-run)
//      node scripts/shopify-cro/inventory-untrack.cjs --apply
const { gql } = require('./shopifyCro.cjs');
const { snapshot } = require('./snapshot.cjs');

const APPLY = process.argv.includes('--apply');
const EXCLUDED_TYPES = ['Pack', 'Compresión'];
const SIZE_OPTION = /^(talla|size|tamaño)$/i;
// Colores con stock pero sin prenda base en Beast Hub: siguen rastreados para no vender lo que no se puede producir.
const KEEP_TRACKED = { 'grafiti-tee-training-shirt': [/caf[eé]/i] };

const NO_BASE_SIZES = /^(2XL|XXL|3XL)$/i;
const sizeOf = (v) => v.selectedOptions.find((o) => SIZE_OPTION.test(o.name))?.value ?? '';
const colorKey = (v) => v.selectedOptions.filter((o) => !SIZE_OPTION.test(o.name)).map((o) => o.value.trim()).join(' / ') || '(único)';

function plan(products) {
  const targets = [];
  for (const p of products) {
    if (p.status !== 'ACTIVE' || EXCLUDED_TYPES.includes(p.productType)) continue;
    const vs = p.variants.nodes;
    if (!vs.some((v) => v.inventoryItem.tracked && v.inventoryQuantity > 0)) continue;
    const byColor = {};
    for (const v of vs) (byColor[colorKey(v)] ??= []).push(v);
    const free = [], kept = [];
    for (const [color, cvs] of Object.entries(byColor)) {
      // Las bases de Tu prenda van de S a XL: las 2XL siguen rastreadas (se venden solo hasta agotar su stock).
      const tracked = cvs.filter((v) => v.inventoryItem.tracked && !NO_BASE_SIZES.test(sizeOf(v)));
      if (!tracked.length) continue;
      const noBase = (KEEP_TRACKED[p.handle] ?? []).some((re) => re.test(color));
      if (!noBase && cvs.some((v) => v.inventoryItem.tracked && v.inventoryQuantity > 0)) free.push({ color, variants: tracked });
      else kept.push(color);
    }
    targets.push({ handle: p.handle, free, kept });
  }
  return targets;
}

// Disponibilidad de un pack = variantes vendibles (no totalInventory: al quedar sin seguimiento sus prendas,
// Shopify recalcula el bundle en ~1 min y lo deja también sin seguimiento, con total 0 pero vendible).
const packAvailability = (products) => Object.fromEntries(products
  .filter((p) => p.productType === 'Pack')
  .map((p) => [p.handle, { status: p.status, sellable: p.variants.nodes.filter((v) => v.availableForSale).length,
    media: p.media.nodes.map((m) => m.id).join(',') }]));

async function main() {
  const { products, file } = await snapshot();
  console.log(`Respaldo: ${file}`);
  const targets = plan(products);
  let n = 0;
  for (const t of targets) {
    const nv = t.free.reduce((a, f) => a + f.variants.length, 0);
    n += nv;
    console.log(`\n${t.handle}: ${nv} variantes → sin seguimiento`);
    for (const f of t.free) console.log(`  libera  ${f.color} (${f.variants.length})`);
    for (const c of t.kept) console.log(`  agotado ${c} (sigue rastreado)`);
  }
  console.log(`\n${targets.length} productos, ${n} variantes. ${APPLY ? 'Aplicando…' : 'Dry-run: nada se escribió (usar --apply).'}`);
  if (!APPLY) return;

  const before = packAvailability(products);
  // La app no tiene write_inventory: se usa productVariantsBulkUpdate (write_products), una llamada por producto.
  const M = `mutation($pid: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $pid, variants: $v) {
    productVariants { id inventoryItem { tracked } } userErrors { field message } } }`;
  const ids = Object.fromEntries(products.map((p) => [p.handle, p.id]));
  for (const t of targets) {
    const v = t.free.flatMap((f) => f.variants).map((x) => ({ id: x.id, inventoryItem: { tracked: false } }));
    if (!v.length) continue;
    const r = (await gql(M, { pid: ids[t.handle], v })).productVariantsBulkUpdate;
    if (r.userErrors.length || r.productVariants.some((x) => x.inventoryItem.tracked)) throw new Error(`${t.handle}: ${JSON.stringify(r.userErrors)}`);
  }
  console.log('Listo. Esperando 90 s a que Shopify recalcule los bundles…');
  await new Promise((r) => setTimeout(r, 90000));
  const after = packAvailability((await snapshot()).products);
  for (const [h, b] of Object.entries(before)) {
    const a = after[h];
    const ok = a && a.status === b.status && a.media === b.media && a.sellable >= b.sellable;
    console.log(`  ${ok ? 'OK ' : '!! '} ${h}: ${b.status} vendibles ${b.sellable} → ${a?.status} ${a?.sellable}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
