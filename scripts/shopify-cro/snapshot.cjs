// Respaldo del catálogo antes de tocar inventario, media, precios o SKUs → .out/snapshot-<fecha>.json
// Guarda por producto: estado, media (orden, url, alt, tamaño), variantes (sku, precio, tracked, cantidad,
// imagen enlazada) y, si es bundle, sus componentes. Uso: node scripts/shopify-cro/snapshot.cjs
const fs = require('fs');
const path = require('path');
const { paginate } = require('./shopifyCro.cjs');

const Q = `query($after: String) { products(first: 25, after: $after) {
  nodes { id handle title status productType tags totalInventory
    media(first: 50) { nodes { id alt mediaContentType ... on MediaImage { image { url width height } } } }
    variants(first: 100) { nodes { id title sku price compareAtPrice inventoryQuantity inventoryPolicy availableForSale
      selectedOptions { name value } media(first: 1) { nodes { id } }
      inventoryItem { id tracked } } }
    bundleComponents(first: 20) { nodes { componentProduct { handle } } }
  }
  pageInfo { hasNextPage endCursor } } }`;

async function snapshot() {
  const products = await paginate(Q, (d) => d.products);
  const out = path.join(__dirname, '.out', `snapshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(products, null, 1));
  return { products, file: out };
}

// Handles que son componentes de un bundle activo (las prendas sueltas sí se tocan; los packs no).
function bundleMap(products) {
  const map = {};
  for (const p of products) {
    if (p.status !== 'ACTIVE') continue;
    for (const c of p.bundleComponents?.nodes ?? []) (map[c.componentProduct.handle] ??= []).push(p.handle);
  }
  return map;
}

if (require.main === module) {
  snapshot().then(({ products, file }) => {
    const bm = bundleMap(products);
    console.log(`${products.length} productos → ${path.relative(process.cwd(), file)}`);
    console.log(`Componentes de bundles activos: ${Object.keys(bm).length}`);
    for (const [h, packs] of Object.entries(bm)) console.log(`  ${h} ← ${packs.join(', ')}`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { snapshot, bundleMap };
