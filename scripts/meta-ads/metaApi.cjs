// Cliente mínimo de la Graph API de Meta Ads para Beast Club.
// Credenciales en .env.local: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_API_VERSION, META_PIXEL_ID, META_PAGE_ID, META_IG_ID.
// Nunca imprime el token.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);

const TOKEN = env.META_ACCESS_TOKEN;
const VERSION = env.META_API_VERSION || 'v21.0';
const ACCOUNT = env.META_AD_ACCOUNT_ID?.startsWith('act_') ? env.META_AD_ACCOUNT_ID : `act_${env.META_AD_ACCOUNT_ID}`;
const PIXEL_ID = env.META_PIXEL_ID;
const PAGE_ID = env.META_PAGE_ID;
const IG_ID = env.META_IG_ID;
if (!TOKEN || !env.META_AD_ACCOUNT_ID) throw new Error('Faltan META_ACCESS_TOKEN / META_AD_ACCOUNT_ID en .env.local');

const BASE = `https://graph.facebook.com/${VERSION}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, p, params = {}) {
  for (let attempt = 0; ; attempt++) {
    const url = new URL(`${BASE}/${p}`);
    let body;
    if (method === 'GET') {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      url.searchParams.set('access_token', TOKEN);
    } else {
      body = new URLSearchParams({ access_token: TOKEN });
      for (const [k, v] of Object.entries(params)) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    const r = await fetch(url, { method, body });
    const j = await r.json();
    const code = j.error?.code;
    if ((code === 4 || code === 17 || code === 80004) && attempt < 4) { await sleep(5000 * (attempt + 1)); continue; }
    if (j.error) throw new Error(`Meta ${method} ${p}: ${j.error.message} (${code}/${j.error.error_subcode ?? ''}) ${j.error.error_user_msg ?? ''}`);
    return j;
  }
}

const get = (p, params) => call('GET', p, params);
const post = (p, params) => call('POST', p, params);

// Subida multipart (videos) al host graph-video.
async function upload(p, fields) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set('access_token', TOKEN);
  const j = await (await fetch(`https://graph-video.facebook.com/${VERSION}/${p}`, { method: 'POST', body: form })).json();
  if (j.error) throw new Error(`Meta upload ${p}: ${j.error.message} ${j.error.error_user_msg ?? ''}`);
  return j;
}

// Recorre la paginación por cursor de un edge.
async function all(p, params = {}) {
  const out = [];
  let after;
  do {
    const j = await get(p, { limit: '100', ...params, ...(after ? { after } : {}) });
    out.push(...(j.data || []));
    after = j.paging?.next ? j.paging.cursors?.after : null;
  } while (after);
  return out;
}

// Suma de una acción del pixel/plataforma en un arreglo `actions`.
const act = (arr, type) => +((arr || []).find((a) => a.action_type === type)?.value || 0);

module.exports = { get, post, upload, all, act, ACCOUNT, PIXEL_ID, PAGE_ID, IG_ID, VERSION, ROOT };
