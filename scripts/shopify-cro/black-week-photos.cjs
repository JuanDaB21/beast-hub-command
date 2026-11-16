// Fotos de la landing Black Week con Nightjar (API) → Shopify Files → plantilla del tema.
// Lee packs y bundles de config.json (vía black-week-setup.plan) y las instrucciones de config.landing.fotos.
// NIGHTJAR_API_KEY va en .env.local. Por defecto es dry-run; solo gasta créditos o escribe con --apply.
//
// Uso: node scripts/shopify-cro/black-week-photos.cjs <modo> [--apply] [--only=clave]
//   plan      Lista las tomas (flat lay por versión + prenda en modelo) y los créditos.
//   test      Prueba de estilos: la toma `fotos.toma_prueba` con cada `fotos.estilos_prueba` (1 crédito c/u).
//   test      Prueba de estilos: la toma `fotos.toma_prueba` con cada `fotos.estilos_prueba` (1 crédito c/u).
//   run       Sube las fotos fuente, lanza las tomas (Idempotency-Key estable: no se cobra dos veces) y descarga.
//             --redo=id1,id2 vuelve a generar esas tomas (1 crédito c/u).
//   shopify   Sube las tomas descargadas a Shopify Files (fileCreate) y guarda el nombre de cada archivo.
//   theme     Escribe las imágenes en ../beastclub-theme/templates/page.black-week.json (image_picker).
const fs = require('fs');
const path = require('path');
const { gql, ROOT } = require('./shopifyCro.cjs');
const { plan, CFG } = require('./black-week-setup.cjs');

const F = CFG.landing.fotos;
const OUT = path.join(__dirname, '.out', 'nightjar');
const STATE_FILE = path.join(OUT, 'state.json');
const THEME_TPL = path.join(ROOT, '..', 'beastclub-theme', 'templates', 'page.black-week.json');
const [mode] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const REDO = (process.argv.find((a) => a.startsWith('--redo='))?.slice(7) ?? '').split(',').filter(Boolean); // run: rehace esas tomas
const API = 'https://api.nightjar.so/v1';

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const state = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { assets: {}, gens: {}, files: {} });
const save = (s) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); };

async function nj(method, p, body, extraHeaders = {}) {
  if (!env.NIGHTJAR_API_KEY) throw new Error('Falta NIGHTJAR_API_KEY en .env.local');
  for (let i = 0; ; i++) {
    const r = await fetch(API + p, {
      method,
      headers: { Authorization: `Bearer ${env.NIGHTJAR_API_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 && i < 6) { await sleep(1000 * Number(r.headers.get('retry-after') || 2 ** i)); continue; }
    const j = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw new Error(`Nightjar ${method} ${p} ${r.status} (Request-Id ${r.headers.get('request-id')}): ${JSON.stringify(j)}`);
    return j;
  }
}

// Tomas: un flat lay por versión de pack y una foto en modelo por prenda única (el short va con el tank).
async function shots() {
  const bundles = await plan();
  const garments = new Map(); // clave → { label, image }
  const list = [];
  const key = (c) => `${c.handle}|${c.colorVal ?? ''}`;
  for (const b of bundles) {
    for (const c of b.comps) garments.set(key(c), { label: c.etiqueta, image: c.image, handle: c.handle });
    list.push({ id: `${b.version}-flat`, kind: 'flat', sources: b.comps.map(key), slot: { version: b.version, n: 'flat' } });
    b.comps.forEach((c, i) => {
      const isShort = /short/i.test(c.etiqueta) && b.comps.length === 3;
      const sources = isShort ? [key(c), key(b.comps[0])] : [key(c)];
      const id = isShort ? `${slug(c.handle)}-con-${slug(b.comps[0].handle)}` : slug(key(c));
      const existing = list.find((s) => s.id === id);
      const slot = { version: b.version, n: `m${i + 1}` };
      if (existing) existing.slots.push(slot);
      else list.push({ id, kind: isShort ? 'outfit' : 'model', sources, slots: [slot], oversized: /oversized/i.test(c.etiqueta) });
    });
  }
  for (const c of CFG.complementos.filter((x) => x.handle)) {
    const p = (await gql(`query($h: String!) { productByHandle(handle: $h) { featuredMedia { preview { image { url } } } } }`, { h: c.handle })).productByHandle;
    garments.set(`${c.handle}|`, { label: c.nombre, image: p?.featuredMedia?.preview?.image?.url, handle: c.handle });
    list.push({ id: slug(c.handle), kind: 'model', sources: [`${c.handle}|`], slots: [{ addon: true }] });
  }
  // Referencias extra (config.landing.fotos.referencias): varias fotos de la galería (ej. espalda + frente)
  // en lugar de la foto de la variante, para las tomas en modelo de esa prenda.
  for (const [handle, idxs] of Object.entries(F.referencias ?? {})) {
    const p = (await gql(`query($h: String!) { productByHandle(handle: $h) { media(first: 20) { nodes { ... on MediaImage { image { url } } } } } }`, { h: handle })).productByHandle;
    for (const [k, g] of [...garments]) {
      if (g.handle !== handle || k.includes('#')) continue;
      const keys = idxs.map((i) => {
        garments.set(`${k}#${i}`, { ...g, image: p?.media.nodes[i]?.image?.url });
        return `${k}#${i}`;
      });
      for (const s of list) if (s.kind !== 'flat') s.sources = s.sources.flatMap((x) => (x === k ? keys : [x]));
    }
  }
  return { list: ONLY ? list.filter((s) => s.id.includes(ONLY)) : list, garments };
}

function body(shot, assetIds, styleId = F.estilo_id) {
  const directions = shot.kind === 'flat'
    ? `${F.flat_lay.replaceAll("{n}", String(shot.sources.length))} ${F.fidelidad}`
    : `${F.en_modelo} ${shot.kind === 'outfit' ? F.outfit_short : ''} ${shot.oversized ? F.calce_oversized : ''} ${F.ajustes?.[shot.id] ?? ''} ${F.fidelidad}`;
  return {
    asset_ids: assetIds,
    ...(styleId && shot.kind !== 'flat' ? { photography_style_id: styleId } : {}),
    background: { type: 'automatic' },
    fashion_model: shot.kind === 'flat' ? { type: 'none' } : { type: 'selected', fashion_model_id: F.modelo.id },
    custom_directions: directions.replace(/\s+/g, ' ').trim(),
    output_mode: 'single_shots',
    image_count: 1,
    ...F.formato,
  };
}

async function uploadSource(url) {
  const res = await fetch(url.includes('?') ? `${url}&width=1600` : `${url}?width=1600`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const session = await nj('POST', '/uploads', { content_type: type, size_bytes: bytes.length }, { 'Idempotency-Key': `bw26-up-${slug(url).slice(-50)}-${Date.now()}` }); // subir no cuesta créditos
  const up = session.upload;
  const put = await fetch(up.url, { method: up.method, headers: up.headers, body: bytes });
  const token = (await put.json().catch(() => ({}))).upload_token;
  if (!put.ok || !token) throw new Error(`Subida fallida (${put.status}) para ${url}`);
  const done = await nj('POST', `/uploads/${session.id}/complete`, { upload_token: token }, { 'Idempotency-Key': `bw26-done-${session.id}` });
  return done.asset?.id ?? done.id;
}

async function cmdPlan() {
  const { list } = await shots();
  for (const s of list) {
    const b = body(s, []);
    console.log(`${s.id.padEnd(58)} ${s.kind.padEnd(6)} fuentes=${s.sources.length} estilo=${b.photography_style_id ?? '-'}${F.ajustes?.[s.id] ? ' +ajuste' : ''} → ${(s.slots ?? [s.slot]).map((x) => x.addon ? 'complemento' : `${x.version}/${x.n}`).join(', ')}`);
  }
  console.log(`\n${list.length} tomas · ${list.length} créditos (1 por imagen a ${F.formato.resolution})`);
}

async function cmdRun() {
  const st = state();
  st.assetSrc ??= {};
  const { list, garments } = await shots();
  for (const id of REDO) {
    delete st.gens[id];
    for (const k of list.find((s) => s.id === id)?.sources ?? []) if (st.assetSrc[k] !== garments.get(k)?.image) delete st.assets[k];
  }
  // Si cambió la foto fuente de una prenda (ej. config.imagen_media), se vuelve a subir.
  for (const [k, g] of garments) if (st.assets[k] && st.assetSrc[k] && st.assetSrc[k] !== g.image) delete st.assets[k];
  const todo = list.filter((s) => !st.gens[s.id]?.file);
  console.log(`${todo.length} tomas pendientes (${todo.length} créditos)`);
  if (!APPLY) return;
  const team = await nj('GET', '/team');
  if (team.credits < todo.length) throw new Error(`Créditos insuficientes: ${team.credits} < ${todo.length}`);

  for (const s of todo) {
    for (const k of s.sources) {
      if (st.assets[k]) continue;
      const g = garments.get(k);
      if (!g?.image) throw new Error(`Sin imagen fuente para ${k}`);
      st.assets[k] = await uploadSource(g.image);
      st.assetSrc[k] = g.image;
      save(st);
    }
    if (!st.gens[s.id]?.id) {
      const assetIds = s.sources.map((k) => st.assets[k]);
      // La llave es la huella de la petición completa: la misma toma (fuentes + instrucciones) nunca se cobra dos veces.
      const req = body(s, assetIds);
      const fp = require('crypto').createHash('sha1').update(JSON.stringify(req)).digest('hex').slice(0, 12);
      const gen = await nj('POST', '/generations/product-photography', req,
        { 'Idempotency-Key': `bw26-${F.version}-${s.id}`.slice(0, 100) + `-${fp}` });
      st.gens[s.id] = { id: gen.id, kind: s.kind };
      save(st);
      console.log(`lanzada ${s.id} → ${gen.id}`);
    }
  }

  for (const s of todo) {
    const rec = st.gens[s.id];
    let gen;
    for (let i = 0; i < 90; i++) {
      gen = await nj('GET', `/generations/${rec.id}`);
      if (gen.outputs?.length && gen.outputs.every((o) => o.status === 'completed' || o.status === 'failed')) break;
      await sleep(5000);
    }
    const o = gen.outputs?.find((x) => x.status === 'completed');
    if (!o) { console.log(`FALLÓ ${s.id}: ${JSON.stringify(gen.outputs?.map((x) => x.error))}`); continue; }
    const asset = o.asset.url ? o.asset : await nj('GET', `/assets/${o.asset.id}`);
    // La versión va en el nombre: Shopify Files no reemplaza un archivo con el mismo nombre.
    const file = `bw-${s.id}`.slice(0, 80) + (F.version === 'v1' ? '' : `-${F.version}`) + `.${F.formato.output_format}`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(await (await fetch(asset.url)).arrayBuffer()));
    Object.assign(rec, { file, url: asset.url, review: o.review, review_note: o.review_note });
    save(st);
    console.log(`listo ${s.id} → ${file} · revisión Nightjar: ${o.review ?? 'n/d'}`);
  }
}

// Prueba de estilos: la misma toma con cada estilo de config.landing.fotos.estilos_prueba (1 crédito c/u).
async function cmdTest() {
  const st = state();
  st.tests ??= {};
  const { list, garments } = await shots();
  const shot = list.find((s) => s.id === F.toma_prueba);
  if (!shot) throw new Error(`No existe la toma ${F.toma_prueba}`);
  console.log(`${F.estilos_prueba.length} variantes de ${shot.id} (${F.estilos_prueba.length} créditos)`);
  if (!APPLY) return;
  for (const k of shot.sources) {
    if (st.assets[k]) continue;
    st.assets[k] = await uploadSource(garments.get(k).image);
    save(st);
  }
  const assetIds = shot.sources.map((k) => st.assets[k]);
  const gens = [];
  for (const s of F.estilos_prueba) {
    const gen = await nj('POST', '/generations/product-photography', body(shot, assetIds, s.id),
      { 'Idempotency-Key': `bw26-${F.version}-test-${slug(s.nombre)}-${assetIds.join('').slice(-12)}` });
    gens.push({ s, id: gen.id });
  }
  for (const { s, id } of gens) {
    let gen;
    for (let i = 0; i < 90; i++) {
      gen = await nj('GET', `/generations/${id}`);
      if (gen.outputs?.length && gen.outputs.every((o) => o.status === 'completed' || o.status === 'failed')) break;
      await sleep(5000);
    }
    const o = gen.outputs?.find((x) => x.status === 'completed');
    if (!o) { console.log(`FALLÓ ${s.nombre}`); continue; }
    const asset = o.asset.url ? o.asset : await nj('GET', `/assets/${o.asset.id}`);
    const file = `test-${slug(s.nombre)}.${F.formato.output_format}`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(await (await fetch(asset.url)).arrayBuffer()));
    st.tests[s.id] = { nombre: s.nombre, file, url: asset.url };
    save(st);
    console.log(`listo ${s.nombre} → ${file}`);
  }
}

async function cmdShopify() {
  const st = state();
  const pending = Object.entries(st.gens).filter(([, g]) => g.url && !st.files[g.file]);
  console.log(`${pending.length} archivos por subir a Shopify Files`);
  if (!APPLY || !pending.length) return;
  const r = await gql(`mutation($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id alt } userErrors { field message } } }`, {
    files: pending.map(([id, g]) => ({ originalSource: g.url, filename: g.file, contentType: 'IMAGE', alt: `Black Week Beast · ${id}` })),
  });
  if (r.fileCreate.userErrors.length) throw new Error(JSON.stringify(r.fileCreate.userErrors));
  for (const [, g] of pending) st.files[g.file] = true;
  save(st);
  console.log('Subidos (Shopify los procesa en segundo plano).');
}

// Escribe shopify://shop_images/<archivo> en los ajustes de cada bloque/versión de la plantilla.
async function cmdTheme() {
  const st = state();
  const { list } = await shots();
  const raw = fs.readFileSync(THEME_TPL, 'utf8');
  const head = raw.match(/^\/\*[\s\S]*?\*\/\s*/)?.[0] ?? ''; // Shopify antepone un comentario a las plantillas
  const tpl = JSON.parse(raw.slice(head.length));
  const blocks = tpl.sections.packs.blocks;
  const ref = (file) => `shopify://shop_images/${file}`;
  let n = 0;
  for (const s of list) {
    const g = st.gens[s.id];
    if (!g?.file || !st.files[g.file]) continue;
    for (const slot of s.slots ?? [s.slot]) {
      if (slot.addon) { tpl.sections.addon.settings.image = ref(g.file); n++; continue; }
      for (const b of Object.values(blocks)) {
        const v = ['1', '2'].find((x) => b.settings[`product_${x}`] === CFG.landing.bundles.find((y) => y.version === slot.version)?.handle);
        if (!v) continue;
        b.settings[`v${v}_${slot.n}`] = ref(g.file);
        n++;
      }
    }
  }
  console.log(`${n} imágenes asignadas en page.black-week.json`);
  if (APPLY) fs.writeFileSync(THEME_TPL, `${head}${JSON.stringify(tpl, null, 2)}\n`);
}

const MODES = { plan: cmdPlan, test: cmdTest, run: cmdRun, shopify: cmdShopify, theme: cmdTheme };
if (!MODES[mode]) { console.error(`Modos: ${Object.keys(MODES).join(', ')}`); process.exit(1); }
MODES[mode]()
  .then(() => { if (!APPLY && mode !== 'plan') console.log('\n(dry-run: agrega --apply)'); })
  .catch((e) => { console.error(e.message); process.exit(1); });
