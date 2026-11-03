// Normaliza el catálogo activo: títulos sin comillas, productType, etiquetas de taxonomía
// (se conservan las existentes: hay colecciones automáticas que dependen de ellas),
// SEO title/description y alt text de imágenes.
// Uso: node scripts/shopify-cro/catalog-update.cjs            (dry-run → .out/catalog-plan.json)
//      node scripts/shopify-cro/catalog-update.cjs --apply
const fs = require('fs');
const path = require('path');
const { gql, paginate } = require('./shopifyCro.cjs');

const APPLY = process.argv.includes('--apply');
const OUT = path.join(__dirname, '.out');

const Q = `query($after: String) { products(first: 50, after: $after, query: "status:active") {
  nodes { id handle title productType vendor tags seo { title description }
    category { fullName }
    variants(first: 1) { nodes { price compareAtPrice } }
    collections(first: 20) { nodes { handle } }
    media(first: 30) { nodes { id alt mediaContentType } } }
  pageInfo { hasNextPage endCursor } } }`;

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function garmentType(p) {
  const t = p.title.toLowerCase();
  const cat = p.category?.fullName ?? '';
  const inCol = (h) => p.collections.nodes.some((c) => c.handle === h);
  if (/compress/.test(t)) return 'Compresión';
  if (/hoodie|buzo/.test(t) || /Hoodies/.test(cat)) return 'Hoodie';
  if (/short/.test(t) || /Shorts/.test(cat)) return 'Short';
  if (/jogger|cargo|pant/.test(t) || /Joggers|Pants/.test(cat)) return 'Jogger';
  if (/tank/.test(t) || /Tank Tops/.test(cat)) return 'Tank';
  if (/crop/.test(t)) return 'Camiseta Cropped';
  if (/slim/.test(t) || inCol('camisetas-slim')) return 'Camiseta Slim';
  return 'Camiseta Oversized';
}

const LABEL = {
  'Compresión': 'Camiseta de compresión', Hoodie: 'Hoodie', Short: 'Short', Jogger: 'Jogger',
  Tank: 'Tank top', 'Camiseta Cropped': 'Camiseta cropped', 'Camiseta Slim': 'Camiseta slim fit',
  'Camiseta Oversized': 'Camiseta oversized',
};

const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const products = await paginate(Q, (d) => d.products);

  // Top 10 por unidades vendidas (60 días) desde el snapshot de audit-sales.cjs.
  const sales = JSON.parse(fs.readFileSync(path.join(OUT, 'sales.json'), 'utf8'));
  const units = {};
  for (const o of sales.orders) for (const l of o.lineItems.nodes) if (l.product) units[l.product.handle] = (units[l.product.handle] || 0) + l.quantity;
  const top = new Set(Object.entries(units).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([h]) => h));

  const plan = products.map((p) => {
    const title = p.title.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
    const type = p.productType || garmentType(p);
    const label = LABEL[type] ?? type;
    const gender = p.tags.includes('Mujer') ? 'mujer' : 'hombre';
    const v = p.variants.nodes[0];
    const add = [`genero:${gender}`, `tipo:${slug(type)}`, `linea:${slug(p.vendor)}`];
    if (v && Number(v.compareAtPrice) > Number(v.price)) add.push('estado:oferta');
    if (top.has(p.handle)) add.push('estado:best-seller');
    const tags = [...new Set([...p.tags.filter((t) => !/^(genero|tipo|linea|estado):/.test(t)), ...add])];
    const full = `${title} | ${label} de gym – Beast Club`;
    const seo = {
      title: full.length <= 70 ? full : cut(`${title} | ${label} de gym`, 70),
      description: cut(`${label} ${title} para entrenar con estilo. Paga al recibir con envío a toda Colombia. Cambios de talla disponibles.`, 160),
    };
    const alts = p.media.nodes.filter((m) => m.mediaContentType === 'IMAGE' && !m.alt)
      .map((m, i) => ({ id: m.id, alt: `${title} – ${label} Beast Club${i ? ` (${i + 1})` : ''}` }));
    return {
      id: p.id, handle: p.handle,
      before: { title: p.title, productType: p.productType, tags: p.tags, seo: p.seo },
      after: { title, productType: type, tags, seo }, alts,
    };
  });

  fs.writeFileSync(path.join(OUT, 'catalog-plan.json'), JSON.stringify(plan, null, 2));
  const n = (f) => plan.filter(f).length;
  console.log(`productos activos=${plan.length}`);
  console.log(`títulos cambian=${n((x) => x.before.title !== x.after.title)} · productType nuevo=${n((x) => !x.before.productType)} · SEO=${plan.length} · imágenes con alt nuevo=${plan.reduce((s, x) => s + x.alts.length, 0)}`);
  const types = {}; for (const x of plan) types[x.after.productType] = (types[x.after.productType] || 0) + 1;
  console.log('tipos:', types);
  for (const x of plan.slice(0, 4)) console.log(`\n${x.before.title}\n  → ${x.after.title} [${x.after.productType}]\n  tags: ${x.after.tags.join(', ')}\n  seo: ${x.after.seo.title}\n       ${x.after.seo.description}`);
  if (!APPLY) { console.log('\nDRY-RUN. Plan en .out/catalog-plan.json. Usa --apply'); return; }

  let done = 0;
  for (const x of plan) {
    const r = (await gql(`mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { userErrors { field message } } }`,
      { product: { id: x.id, title: x.after.title, productType: x.after.productType, tags: x.after.tags, seo: x.after.seo } })).productUpdate;
    if (r.userErrors.length) throw new Error(`${x.handle}: ${JSON.stringify(r.userErrors)}`);
    if (x.alts.length) {
      const f = (await gql(`mutation($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { userErrors { field message } } }`,
        { files: x.alts })).fileUpdate;
      if (f.userErrors.length) throw new Error(`${x.handle} alt: ${JSON.stringify(f.userErrors)}`);
    }
    done++;
  }
  console.log(`\nAplicado en ${done} productos. Respaldo del estado previo: .out/catalog-plan.json (campo "before").`);
})().catch((e) => { console.error(e.message); process.exit(1); });
