// Snapshot de catálogo, colecciones y menús → scripts/shopify-cro/.out/catalog.json
// Uso: node scripts/shopify-cro/audit-catalog.cjs
const fs = require('fs');
const path = require('path');
const { gql, paginate } = require('./shopifyCro.cjs');

const OUT = path.join(__dirname, '.out');

const PRODUCTS_Q = `query($after: String) { products(first: 50, after: $after) {
  nodes { id handle title status productType vendor tags totalInventory createdAt
    onlineStoreUrl seo { title description }
    category { fullName }
    description
    media(first: 20) { nodes { mediaContentType alt } }
    variants(first: 50) { nodes { id title sku price compareAtPrice inventoryQuantity availableForSale } }
    collections(first: 20) { nodes { handle } }
  }
  pageInfo { hasNextPage endCursor } } }`;

const COLLECTIONS_Q = `query($after: String) { collections(first: 50, after: $after) {
  nodes { id handle title sortOrder productsCount { count }
    ruleSet { appliedDisjunctively rules { column relation condition } }
    seo { title description } }
  pageInfo { hasNextPage endCursor } } }`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const products = await paginate(PRODUCTS_Q, (d) => d.products);
  const collections = await paginate(COLLECTIONS_Q, (d) => d.collections);
  const { menus } = await gql(`{ menus(first: 20) { nodes { handle title
    items { title type url items { title type url items { title url } } } } } }`);
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify({ products, collections, menus: menus.nodes }, null, 2));
  console.log(`productos=${products.length} colecciones=${collections.length} menus=${menus.nodes.length} → .out/catalog.json`);
})().catch((e) => { console.error(e.message); process.exit(1); });
