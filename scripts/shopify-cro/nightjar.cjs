// Cliente mínimo de la API de Nightjar (https://nightjar.so/openapi.json). Clave: NIGHTJAR_API_KEY en .env.local.
// Estado compartido en .out/nightjar/state.json: { assets: {clave: ast_id}, products: {clave: prd_id}, gens: {clave: {...}} }.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const KEY = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^NIGHTJAR_API_KEY=(.*)$/m)?.[1].trim().replace(/^"|"$/g, '');
if (!KEY) throw new Error('Falta NIGHTJAR_API_KEY en .env.local');
const API = 'https://api.nightjar.so/v1';
const OUT = path.join(__dirname, '.out', 'nightjar');
const STATE_FILE = path.join(OUT, 'state.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadState() {
  const s = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  return { assets: {}, products: {}, gens: {}, ...s };
}
function saveState(s) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

async function call(method, p, body, idem) {
  for (let attempt = 0; ; attempt++) {
    const headers = { Authorization: `Bearer ${KEY}` };
    if (body) headers['Content-Type'] = 'application/json';
    if (idem) headers['Idempotency-Key'] = idem;
    const r = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await sleep(3000 * (attempt + 1)); continue; }
    const t = await r.text();
    // Otra petición con la misma Idempotency-Key sigue en curso (p. ej. dos tomas que suben la misma referencia).
    if (r.status === 409 && t.includes('idempotency_in_progress') && attempt < 10) { await sleep(3000); continue; }
    if (!r.ok) throw new Error(`Nightjar ${method} ${p} ${r.status} (${r.headers.get('Request-Id')}): ${t.slice(0, 800)}`);
    return t ? JSON.parse(t) : null;
  }
}
const get = (p) => call('GET', p);
// Todo POST exige Idempotency-Key; si no se pasa una, se deriva del cuerpo (mismo cuerpo = misma operación).
const post = (p, b, idem) => call('POST', p, b,
  idem ?? crypto.createHash('sha256').update(p + JSON.stringify(b ?? {})).digest('hex').slice(0, 40));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };

// Sube bytes de imagen y devuelve el Asset. key: identificador estable para no volver a subir.
async function uploadBytes(buf, contentType) {
  const up = await post('/uploads', { content_type: contentType, size_bytes: buf.length },
    crypto.createHash('sha256').update(buf).digest('hex').slice(0, 40));
  const r = await fetch(up.upload.url, { method: 'POST', headers: up.upload.headers, body: buf });
  if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const { upload_token } = await r.json();
  return post(`/uploads/${up.id}/complete`, { upload_token });
}

// src: ruta local o URL (Shopify CDN). Cachea el asset_id en el estado bajo `key`.
async function assetFor(state, key, src) {
  if (state.assets[key]) return state.assets[key];
  let buf, type;
  if (/^https?:/.test(src)) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`descarga ${src}: ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
    type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  } else {
    buf = fs.readFileSync(src);
    type = MIME[path.extname(src).toLowerCase()] || 'image/jpeg';
  }
  // La misma imagen bajo otra clave: reutilizar el asset (Nightjar respondería con la subida vieja ya vencida).
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  state.assetsByHash ??= {};
  if (state.assetsByHash[hash]) { state.assets[key] = state.assetsByHash[hash]; saveState(state); return state.assets[key]; }
  const asset = await uploadBytes(buf, type);
  state.assets[key] = asset.id;
  state.assetsByHash[hash] = asset.id;
  saveState(state);
  return asset.id;
}

async function productFor(state, key, { name, description, assetIds }) {
  if (state.products[key]) return state.products[key];
  const p = await post('/products', { name: name.slice(0, 120), description: description?.slice(0, 2000) || undefined,
    asset_ids: assetIds, primary_asset_id: assetIds[0] });
  state.products[key] = p.id;
  saveState(state);
  return p.id;
}

// Lanza una generación de product-photography (idempotente por `key`) y espera a que termine.
async function generate(state, key, body) {
  const prev = state.gens[key];
  let g = prev?.id ? await get(`/generations/${prev.id}`) : null;
  if (!g) {
    const idem = crypto.createHash('sha256').update(key + JSON.stringify(body)).digest('hex').slice(0, 40);
    g = await post('/generations/product-photography', body, idem);
    state.gens[key] = { id: g.id, status: g.status, files: [], review: null };
    saveState(state);
  }
  const done = (x) => x.output_summary && x.output_summary.pending + x.output_summary.processing === 0 && x.output_summary.total > 0;
  for (let i = 0; i < 120 && !done(g); i++) {
    await sleep(10000);
    g = await get(`/generations/${g.id}`);
  }
  if (!done(g)) throw new Error(`Generación ${g.id} sin terminar tras 20 min`);
  state.gens[key].status = g.status;
  state.gens[key].credits = g.credits;
  state.gens[key].outputs = [];
  for (const o of g.outputs || []) {
    const id = o.asset?.id;
    const url = id ? (await get(`/assets/${id}`)).url : null;
    state.gens[key].outputs.push({ status: o.status, asset_id: id, url, error: o.error });
  }
  saveState(state);
  return g;
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`descarga ${url}: ${r.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

module.exports = { get, post, loadState, saveState, assetFor, productFor, generate, download, OUT };
