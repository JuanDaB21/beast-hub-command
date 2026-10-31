// Limpia el menú principal (sin colecciones vacías o agotadas) y arma el pie de página
// con políticas y contacto. Snapshot previo en .out/menus-snapshot.json.
// Uso: node scripts/shopify-cro/menus-update.cjs [--apply]
const fs = require('fs');
const path = require('path');
const { gql } = require('./shopifyCro.cjs');

const APPLY = process.argv.includes('--apply');
const C = (id) => `gid://shopify/Collection/${id}`;
const col = (title, id, extra = {}) => ({ title, type: 'COLLECTION', resourceId: C(id), ...extra });
const http = (title, url) => ({ title, type: 'HTTP', url });

const MAIN = [
  { title: 'INICIO', type: 'FRONTPAGE', url: '/' },
  col('MÁS VENDIDOS', '293251022938'),
  col('HOMBRE', '288421937242', { items: [
    col('EN TENDENCIA', '293251022938', { tags: ['Hombre'] }),
    col('CAMISETAS OVERSIZED', '285964304474', { tags: ['Hombre'] }),
    col('TANKS', '287490441306', { tags: ['Hombre'] }),
    col('COMPRESIÓN', '317338386522'),
    col('SHORTS', '287489065050', { tags: ['Hombre'] }),
    col('CAMISETAS SLIM', '288065945690'),
  ] }),
  col('MUJER', '288421904474', { items: [
    col('EN TENDENCIA', '293251022938', { tags: ['Mujer'] }),
    col('CAMISETAS OVERSIZED', '288120569946', { tags: ['Mujer'] }),
  ] }),
  col('LO ÚLTIMO', '287489228890', { items: [
    col('WARWOLF🐺', '295394705498'),
    col('PARA ÉL', '287489228890', { tags: ['Hombre'] }),
    col('PARA ELLA', '287489228890', { tags: ['Mujer'] }),
  ] }),
  col('OFERTAS', '286197088346'),
];

const FOOTER = [
  { title: 'Búsqueda', type: 'SEARCH', url: '/search' },
  http('Contacto', '/pages/contact'),
  http('Envíos', '/policies/shipping-policy'),
  http('Cambios y devoluciones', '/policies/refund-policy'),
  http('Privacidad', '/policies/privacy-policy'),
  http('Términos del servicio', '/policies/terms-of-service'),
];

const UPDATE = `mutation($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
  menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { handle items { title } } userErrors { field message } } }`;

(async () => {
  const { menus } = await gql(`{ menus(first: 10) { nodes { id handle title } } }`);
  const byHandle = Object.fromEntries(menus.nodes.map((m) => [m.handle, m]));
  for (const [handle, items] of [['main-menu', MAIN], ['footer', FOOTER]]) {
    const m = byHandle[handle];
    const show = (it, ind = '  ') => it.forEach((x) => { console.log(ind + x.title + (x.tags ? ` [${x.tags}]` : '')); if (x.items) show(x.items, ind + '  '); });
    console.log(`\n${handle}:`); show(items);
    if (!APPLY) continue;
    const r = (await gql(UPDATE, { id: m.id, title: m.title, handle, items })).menuUpdate;
    if (r.userErrors.length) throw new Error(`${handle}: ${JSON.stringify(r.userErrors)}`);
    console.log('  ✓ actualizado');
  }
  if (!APPLY) console.log('\nDRY-RUN. Usa --apply');
})().catch((e) => { console.error(e.message); process.exit(1); });
