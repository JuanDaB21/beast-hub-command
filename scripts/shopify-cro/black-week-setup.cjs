// Montaje de la Black Week en Shopify a partir de docs/marketing/black-week-2026/config.json.
// Por defecto es dry-run: imprime lo que haría. Solo escribe con --apply.
//
// Uso: node scripts/shopify-cro/black-week-setup.cjs <modo> [--apply]
//   check                Solo lectura: tallas que entran, variantes por bundle (máx. 100), regular vs pack.
//   staging              Duplica el tema MAIN como «Beast BW – staging».
//   bundles [--only=v]   Crea los 5 bundles (productBundleCreate), fija precio/tachado, metafields e imágenes.
//   media [--only=v]     Rehace la galería del bundle (1 foto por prenda, en orden).
//   retire               Pasa a borrador los bundles de la campaña que ya no están en config.
//   page                 Crea la página /pages/black-week-beast con su plantilla.
//   discount             Envío gratis automático en la ventana de la campaña desde el umbral.
//   prices start|revert  Precio Black Week de los complementos y su reversión.
const fs = require('fs');
const path = require('path');
const { gql, ROOT } = require('./shopifyCro.cjs');

const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marketing/black-week-2026/config.json'), 'utf8'));
const L = CFG.landing;
const STATE_FILE = path.join(__dirname, '.out', 'black-week-state.json');
const [mode, sub] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7); // bundles: una sola versión (ej. trio-negro)

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL'];
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
const cop = (n) => Math.round(n).toLocaleString('es-CO');
const state = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {});
const saveState = (patch) => {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state(), ...patch }, null, 2));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Un bundle recién creado queda «en modificación» unos segundos: reintenta esas mutaciones.
async function gqlRetry(q, v) {
  for (let i = 0; ; i++) {
    try {
      const d = await gql(q, v);
      if (i < 40 && /currently being modified/.test(JSON.stringify(d))) { await sleep(3000); continue; }
      return d;
    } catch (e) {
      if (i >= 40 || !/TOO_MANY_PARALLEL_REQUESTS|currently being modified/.test(e.message)) throw e;
      await sleep(3000);
    }
  }
}
const errs = (r) => {
  if (r.userErrors?.length) throw new Error(JSON.stringify(r.userErrors));
  return r;
};

const PRODUCT_Q = `query($h: String!) { productByHandle(handle: $h) {
  id title handle
  featuredMedia { preview { image { url } } }
  media(first: 20) { nodes { ... on MediaImage { image { url } } } }
  options { id name values }
  variants(first: 100) { nodes { id price compareAtPrice availableForSale selectedOptions { name value } image { url } } }
} }`;
const cache = new Map();
async function product(handle) {
  if (!cache.has(handle)) cache.set(handle, (await gql(PRODUCT_Q, { h: handle })).productByHandle);
  return cache.get(handle);
}

// Arma la definición de cada bundle cruzando config.packs (componentes) y config.landing.bundles (títulos/etiquetas).
async function plan() {
  const out = [];
  for (const pack of CFG.packs) {
    for (const v of pack.versiones) {
      const meta = L.bundles.find((b) => b.version === v.id);
      if (!meta) throw new Error(`Falta landing.bundles para ${v.id}`);
      const comps = [];
      for (const [i, c] of v.componentes.entries()) {
        const p = await product(c.handle);
        if (!p) throw new Error(`No existe el producto ${c.handle}`);
        const colorOpt = p.options.find((o) => /color|colour/i.test(o.name));
        const sizeOpt = p.options.find((o) => /talla|size/i.test(o.name));
        const colorVal = colorOpt?.values.find((x) => norm(x) === norm(c.color));
        if (colorOpt && !colorVal) throw new Error(`${c.handle}: color «${c.color}» no está en ${colorOpt.values.join(' | ')}`);
        const ofColor = p.variants.nodes.filter((x) => !colorOpt || x.selectedOptions.some((o) => o.name === colorOpt.name && o.value === colorVal));
        const sizeOf = (x) => x.selectedOptions.find((o) => o.name === sizeOpt.name).value;
        const sizes = sizeOpt.values
          .filter((s) => ofColor.some((x) => sizeOf(x) === s && x.availableForSale))
          .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
        const out_ = ofColor.filter((x) => !x.availableForSale).map(sizeOf);
        // Precio de lista: el más alto entre precio y tachado (compareAtPrice) de la prenda.
        const price = Math.max(...ofColor.map((x) => Math.max(Number(x.price), Number(x.compareAtPrice || 0))));
        // Foto del color correcto: imagen de la variante; si el producto no tiene imágenes por variante,
        // config puede fijar `imagen_media` (índice en la galería); si no, la foto principal.
        const image = ofColor.find((x) => x.image)?.image.url
          || (c.imagen_media != null ? p.media.nodes[c.imagen_media]?.image?.url : null)
          || p.featuredMedia?.preview?.image?.url || null;
        comps.push({ handle: c.handle, id: p.id, title: p.title, etiqueta: meta.etiquetas[i], colorOpt, colorVal, sizeOpt, sizes, out: out_, price, image });
      }
      // Grupos de talla: las prendas de un grupo comparten selector (Shopify admite máx. 3 opciones por bundle).
      const groups = (meta.grupos ?? comps.map((_, i) => [i])).map((idx, g) => ({
        idx,
        label: meta.grupo_etiquetas?.[g] ?? comps[idx[0]].etiqueta,
        sizes: comps[idx[0]].sizes.filter((s) => idx.every((i) => comps[i].sizes.includes(s))),
      }));
      const variants = groups.reduce((n, g) => n * g.sizes.length, 1);
      const regular = comps.reduce((n, c) => n + c.price, 0);
      out.push({
        pack: pack.id, version: v.id, ...meta, price: pack.precio, freeShipping: Boolean(pack.envio_gratis),
        regular, variants, comps, groups, story: L.historias[pack.id],
      });
    }
  }
  return out;
}

async function check() {
  for (const b of await plan()) {
    const ok = b.variants <= 100 && b.groups.length <= 3 ? 'ok' : 'EXCEDE LÍMITES';
    console.log(`\n${b.titulo} (${b.handle}) · ${b.groups.length} opciones · ${b.variants} variantes [${ok}] · lista ${cop(b.regular)} → pack ${cop(b.price)} · ahorro ${cop(b.regular - b.price)} (${Math.round((1 - b.price / b.regular) * 100)} %)${b.freeShipping ? ' · envío gratis' : ''}`);
    for (const g of b.groups.filter((x) => x.idx.length > 1)) console.log(`  * selector compartido «${g.label}»: ${g.sizes.join('/')}`);
    for (const c of b.comps) {
      console.log(`  - ${c.etiqueta}: ${c.title} · ${c.colorVal ?? '(sin color)'} · tallas ${c.sizes.join('/')}${c.out.length ? ` · fuera: ${c.out.join('/')}` : ''} · ${cop(c.price)}`);
    }
  }
}

async function staging() {
  const { themes } = await gql('{ themes(first: 20) { nodes { id name role } } }');
  const name = 'Beast BW – staging';
  const existing = themes.nodes.find((t) => t.name === name);
  if (existing) return console.log(`Ya existe: ${existing.id} [${existing.role}]`);
  const main = themes.nodes.find((t) => t.role === 'MAIN');
  console.log(`Duplicar «${main.name}» (${main.id}) → «${name}»`);
  if (!APPLY) return;
  const r = errs((await gql(`mutation($id: ID!, $name: String) { themeDuplicate(id: $id, name: $name) {
    newTheme { id name role } userErrors { field message } } }`, { id: main.id, name })).themeDuplicate);
  saveState({ stagingThemeId: r.newTheme.id });
  console.log(`Creado ${r.newTheme.id} [${r.newTheme.role}]`);
}

const OP_Q = `query($id: ID!) { productOperation(id: $id) { ... on ProductBundleOperation {
  status product { id handle } userErrors { field message } } } }`;

async function bundles() {
  for (const b of await plan()) {
    if (ONLY && b.version !== ONLY) continue;
    const existing = (await gql(PRODUCT_Q, { h: b.handle })).productByHandle;
    console.log(`\n${b.titulo} → ${b.handle} · ${b.variants} variantes · ${cop(b.price)} (tachado ${cop(b.regular)})${existing ? ' · YA EXISTE, solo se actualiza' : ''}`);
    if (b.variants > 100 || b.groups.length > 3) throw new Error(`${b.handle} excede los límites de Shopify Bundles`);
    if (!APPLY) continue;

    let productId = existing?.id;
    if (!productId) {
      const groupOf = (i) => b.groups.find((g) => g.idx.includes(i));
      const components = b.comps.map((c, i) => ({
        productId: c.id,
        quantity: 1,
        optionSelections: [
          ...(c.colorOpt ? [{ componentOptionId: c.colorOpt.id, name: `Color · ${c.etiqueta}`, values: [c.colorVal] }] : []),
          { componentOptionId: c.sizeOpt.id, name: `Talla · ${groupOf(i).label}`, values: groupOf(i).sizes },
        ],
      }));
      const input = { title: b.titulo, components };
      // Con grupos, cada selector de talla del bundle mapea su valor a la talla de todas las prendas del grupo.
      if (b.groups.some((g) => g.idx.length > 1)) {
        input.consolidatedOptions = b.groups.map((g) => ({
          optionName: `Talla · ${g.label}`,
          optionSelections: g.sizes.map((s) => ({
            optionValue: s,
            components: g.idx.map((i) => ({ componentOptionId: b.comps[i].sizeOpt.id, componentOptionValue: s })),
          })),
        }));
      }
      const op = errs((await gql(`mutation($input: ProductBundleCreateInput!) { productBundleCreate(input: $input) {
        productBundleOperation { id status } userErrors { field message } } }`,
      { input })).productBundleCreate);
      let st = op.productBundleOperation;
      for (let i = 0; i < 30 && st.status !== 'COMPLETE'; i++) {
        await sleep(2000);
        st = (await gql(OP_Q, { id: op.productBundleOperation.id })).productOperation;
      }
      if (st.status !== 'COMPLETE' || !st.product) throw new Error(`Bundle ${b.handle}: ${st.status} ${JSON.stringify(st.userErrors)}`);
      productId = st.product.id;
    }

    // Ficha: handle, estado, oculto de la búsqueda, metafields de la landing e imágenes de las prendas reales.
    errs((await gqlRetry(`mutation($p: ProductUpdateInput!, $m: [CreateMediaInput!]) { productUpdate(product: $p, media: $m) {
      product { id } userErrors { field message } } }`, {
      p: {
        id: productId,
        handle: b.handle,
        title: b.titulo,
        status: 'ACTIVE',
        productType: 'Pack',
        vendor: 'Beast Club',
        tags: ['black-week', `pack-${b.pack}`],
        templateSuffix: 'pack',
        metafields: [
          { namespace: 'seo', key: 'hidden', type: 'number_integer', value: '1' },
          { namespace: 'beast', key: 'pack_items', type: 'list.product_reference', value: JSON.stringify(b.comps.map((c) => c.id)) },
          { namespace: 'beast', key: 'pack_labels', type: 'list.single_line_text_field', value: JSON.stringify(b.comps.map((c) => c.etiqueta)) },
          { namespace: 'beast', key: 'pack_story', type: 'list.single_line_text_field', value: JSON.stringify(b.story) },
          { namespace: 'beast', key: 'pack_id', type: 'single_line_text_field', value: b.pack },
          { namespace: 'beast', key: 'pack_option_items', type: 'json', value: JSON.stringify(b.groups.map((g) => g.idx)) },
          { namespace: 'beast', key: 'free_shipping', type: 'boolean', value: String(b.freeShipping) },
        ],
      },
      m: existing?.featuredMedia ? null : b.comps.filter((c) => c.image).map((c) => ({ originalSource: c.image, mediaContentType: 'IMAGE', alt: c.etiqueta })),
    })).productUpdate);

    // Precio fijo del pack y tachado = suma del precio de lista de las prendas (máx. entre precio y tachado).
    const vs = (await gql(`query($id: ID!) { product(id: $id) { variants(first: 100) { nodes { id } } } }`, { id: productId })).product.variants.nodes;
    errs((await gqlRetry(`mutation($id: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $id, variants: $v) {
      userErrors { field message } } }`, {
      id: productId,
      v: vs.map((x) => ({ id: x.id, price: String(b.price), compareAtPrice: String(b.regular) })),
    })).productVariantsBulkUpdate);

    await publish(productId);
    saveState({ bundles: { ...(state().bundles || {}), [b.version]: productId } });
    console.log(`  listo: ${productId} · ${vs.length} variantes`);
  }
}

// Rehace la galería del bundle: una foto por prenda, en el orden del pack (la landing depende de ese orden).
async function media() {
  for (const b of await plan()) {
    if (ONLY && b.version !== ONLY) continue;
    const p = (await gql(`query($h: String!) { productByHandle(handle: $h) { id media(first: 20) { nodes { id } } } }`, { h: b.handle })).productByHandle;
    if (!p) continue;
    console.log(`${b.handle}: ${p.media.nodes.length} fotos → ${b.comps.length} (${b.comps.map((c) => c.etiqueta).join(' / ')})`);
    if (!APPLY) continue;
    if (p.media.nodes.length) {
      errs((await gqlRetry(`mutation($id: ID!, $m: [ID!]!) { productDeleteMedia(productId: $id, mediaIds: $m) { mediaUserErrors { field message } } }`,
        { id: p.id, m: p.media.nodes.map((x) => x.id) })).productDeleteMedia.mediaUserErrors?.length ? { userErrors: [{ message: 'productDeleteMedia' }] } : {});
    }
    errs((await gqlRetry(`mutation($p: ProductUpdateInput!, $m: [CreateMediaInput!]) { productUpdate(product: $p, media: $m) { userErrors { field message } } }`, {
      p: { id: p.id },
      m: b.comps.filter((c) => c.image).map((c) => ({ originalSource: c.image, mediaContentType: 'IMAGE', alt: c.etiqueta })),
    })).productUpdate);
  }
}

// Pasa a borrador los bundles de la campaña que ya no están en config (reversible: status ACTIVE).
async function retire() {
  const keep = new Set(L.bundles.map((b) => b.handle));
  const { products } = await gql('{ products(first: 50, query: "tag:black-week status:active") { nodes { id handle title } } }');
  for (const p of products.nodes.filter((x) => !keep.has(x.handle))) {
    console.log(`Borrador: ${p.title} (${p.handle})`);
    if (APPLY) errs((await gqlRetry(`mutation($p: ProductUpdateInput!) { productUpdate(product: $p) { userErrors { field message } } }`,
      { p: { id: p.id, status: 'DRAFT' } })).productUpdate);
  }
}

async function onlineStorePublicationId() {
  const { publications } = await gql('{ publications(first: 20) { nodes { id name } } }');
  return publications.nodes.find((p) => /online store|tienda online/i.test(p.name))?.id;
}

async function publish(id) {
  const pub = await onlineStorePublicationId();
  if (!pub) return console.log('  (sin publicación Online Store: publicar a mano)');
  errs((await gqlRetry(`mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) {
    userErrors { field message } } }`, { id, input: [{ publicationId: pub }] })).publishablePublish);
}

async function page() {
  const { pagina } = L;
  const { pages } = await gql(`query($q: String!) { pages(first: 1, query: $q) { nodes { id handle templateSuffix isPublished } } }`, { q: `handle:${pagina.handle}` });
  const ex = pages.nodes.find((p) => p.handle === pagina.handle);
  console.log(ex ? `Ya existe ${ex.id} (template ${ex.templateSuffix})` : `Crear /pages/${pagina.handle} con plantilla page.${pagina.template_suffix}`);
  if (!APPLY || ex) return;
  const r = errs((await gql(`mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle } userErrors { field message } } }`, {
    page: { title: pagina.titulo, handle: pagina.handle, templateSuffix: pagina.template_suffix, isPublished: true, body: '' },
  })).pageCreate);
  saveState({ pageId: r.page.id });
  console.log(`Creada ${r.page.id}`);
}

async function discount() {
  const title = `Black Week Beast · Envío gratis desde ${cop(CFG.envio.umbral_black_week)}`;
  const input = {
    title,
    startsAt: new Date(L.inicio_iso).toISOString(),
    endsAt: new Date(L.fin_iso).toISOString(),
    minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(CFG.envio.umbral_black_week) } },
    destination: { all: true },
    combinesWith: { productDiscounts: true, orderDiscounts: true },
  };
  console.log(JSON.stringify(input, null, 2));
  if (!APPLY) return;
  const r = errs((await gql(`mutation($d: DiscountAutomaticFreeShippingInput!) { discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $d) {
    automaticDiscountNode { id } userErrors { field message } } }`, { d: input })).discountAutomaticFreeShippingCreate);
  saveState({ discountId: r.automaticDiscountNode.id });
  console.log(`Creado ${r.automaticDiscountNode.id}`);
}

async function prices() {
  if (!['start', 'revert'].includes(sub)) throw new Error('Uso: prices start|revert');
  for (const c of CFG.complementos.filter((x) => x.handle)) {
    const p = await product(c.handle);
    const v = sub === 'start'
      ? p.variants.nodes.map((x) => ({ id: x.id, price: String(c.precio_black_week), compareAtPrice: String(c.precio_actual) }))
      : p.variants.nodes.map((x) => ({ id: x.id, price: String(c.precio_actual), compareAtPrice: null }));
    console.log(`${p.title}: ${sub === 'start' ? `${cop(c.precio_black_week)} (tachado ${cop(c.precio_actual)})` : `${cop(c.precio_actual)} sin tachado`} · ${v.length} variantes`);
    if (!APPLY) continue;
    errs((await gqlRetry(`mutation($id: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $id, variants: $v) {
      userErrors { field message } } }`, { id: p.id, v })).productVariantsBulkUpdate);
  }
}

module.exports = { plan, CFG };

if (require.main === module) {
  const MODES = { check, staging, bundles, media, retire, page, discount, prices };
  if (!MODES[mode]) {
    console.error(`Modo desconocido. Opciones: ${Object.keys(MODES).join(', ')}`);
    process.exit(1);
  }
  MODES[mode]()
    .then(() => { if (!APPLY && mode !== 'check') console.log('\n(dry-run: agrega --apply para escribir)'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
