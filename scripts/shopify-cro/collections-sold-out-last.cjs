// Ordena cada colección con los productos disponibles primero (en su orden "natural")
// y los agotados al final. Pasa la colección a orden MANUAL, así que hay que re-ejecutarlo
// cuando cambie el stock (p. ej. semanal).
//
// El orden natural de cada colección se guarda en collections-base-sort.json la primera vez
// (su sortOrder original: BEST_SELLING, CREATED_DESC...) y se reutiliza en cada corrida.
//
// Uso: node scripts/shopify-cro/collections-sold-out-last.cjs            (dry-run)
//      node scripts/shopify-cro/collections-sold-out-last.cjs --apply
const fs = require('fs');
const path = require('path');
const { gql, paginate } = require('./shopifyCro.cjs');

const APPLY = process.argv.includes('--apply');
const BASE_FILE = path.join(__dirname, 'collections-base-sort.json');
const OUT = path.join(__dirname, '.out');

// sortOrder de colección → sortKey de ProductCollectionSortKeys (+ reverse).
const SORT_MAP = {
  BEST_SELLING: ['BEST_SELLING', false],
  CREATED_DESC: ['CREATED', true],
  CREATED: ['CREATED', false],
  PRICE_ASC: ['PRICE', false],
  PRICE_DESC: ['PRICE', true],
  ALPHA_ASC: ['TITLE', false],
  ALPHA_DESC: ['TITLE', true],
  MOST_RELEVANT: ['BEST_SELLING', false],
  MANUAL: ['MANUAL', false],
};

const PRODUCTS_Q = `query($id: ID!, $after: String, $sortKey: ProductCollectionSortKeys, $reverse: Boolean) {
  collection(id: $id) { products(first: 100, after: $after, sortKey: $sortKey, reverse: $reverse) {
    nodes { id title status variants(first: 100) { nodes { availableForSale } } }
    pageInfo { hasNextPage endCursor } } } }`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const collections = await paginate(`query($after: String) { collections(first: 100, after: $after) {
    nodes { id handle title sortOrder productsCount { count } } pageInfo { hasNextPage endCursor } } }`, (d) => d.collections);

  const base = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : {};
  for (const c of collections) base[c.handle] ??= c.sortOrder;
  fs.writeFileSync(BASE_FILE, JSON.stringify(base, null, 2) + '\n');

  // Las colecciones de la pauta las ordena collection-order.cjs (también deja los agotados al final).
  const ADS = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, 'collection-order.json'), 'utf8')).collections);

  const snapshot = [];
  let changed = 0;
  for (const c of collections) {
    if (!c.productsCount.count) continue;
    if (ADS.includes(c.handle)) { console.log(`= ${c.handle.padEnd(28)} (collection-order.cjs)`); continue; }
    const [sortKey, reverse] = SORT_MAP[base[c.handle]] ?? SORT_MAP.MANUAL;
    const products = await paginate(PRODUCTS_Q, (d) => d.collection.products, { id: c.id, sortKey, reverse });
    const isAvailable = (p) => p.status === 'ACTIVE' && p.variants.nodes.some((v) => v.availableForSale);
    const ordered = [...products.filter(isAvailable), ...products.filter((p) => !isAvailable(p))];

    const { collection: cur } = await gql(PRODUCTS_Q.replace('first: 100', 'first: 250'), { id: c.id, sortKey: 'COLLECTION_DEFAULT', reverse: false });
    const currentIds = cur.products.nodes.map((p) => p.id);
    const same = c.sortOrder === 'MANUAL' && currentIds.join() === ordered.map((p) => p.id).join();
    const available = products.filter(isAvailable).length;
    const soldOut = products.length - available;
    // Sin agotados, o todo agotado: no hay nada que ganar y se conserva el orden automático.
    const skip = same || soldOut === 0 || available === 0;
    snapshot.push({ handle: c.handle, sortOrder: c.sortOrder, order: currentIds });
    console.log(`${skip ? '=' : '~'} ${c.handle.padEnd(28)} base=${base[c.handle].padEnd(13)} actual=${c.sortOrder.padEnd(13)} disponibles=${available} al final=${soldOut}`);
    if (skip || !APPLY) continue;

    if (c.sortOrder !== 'MANUAL') {
      const u = await gql(`mutation($input: CollectionInput!) { collectionUpdate(input: $input) { userErrors { message } } }`,
        { input: { id: c.id, sortOrder: 'MANUAL' } });
      if (u.collectionUpdate.userErrors.length) throw new Error(`${c.handle}: ${JSON.stringify(u.collectionUpdate.userErrors)}`);
    }
    const moves = ordered.map((p, i) => ({ id: p.id, newPosition: String(i) }));
    for (let i = 0; i < moves.length; i += 250) {
      const r = await gql(`mutation($id: ID!, $moves: [MoveInput!]!) { collectionReorderProducts(id: $id, moves: $moves) {
        job { id } userErrors { message } } }`, { id: c.id, moves: moves.slice(i, i + 250) });
      if (r.collectionReorderProducts.userErrors.length) throw new Error(`${c.handle}: ${JSON.stringify(r.collectionReorderProducts.userErrors)}`);
    }
    changed++;
  }
  const snapFile = path.join(OUT, `collections-snapshot-${Date.now()}.json`);
  fs.writeFileSync(snapFile, JSON.stringify(snapshot, null, 2));
  console.log(`\n${APPLY ? `Aplicado en ${changed} colecciones` : 'DRY-RUN (sin cambios). Usa --apply'} · snapshot: ${path.basename(snapFile)}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
