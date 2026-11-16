// Aplica plan.json en Meta por fases. Sin flag = dry-run (solo imprime).
//   node scripts/meta-ads/apply.cjs            → muestra lo que haría
//   node scripts/meta-ads/apply.cjs --create   → sube recursos y crea creativos + anuncios en PAUSA
//   node scripts/meta-ads/apply.cjs --previews → genera .out/previews.html con vistas previas por ubicación
//   node scripts/meta-ads/apply.cjs --activate → (requiere OK del dueño) ajusta el conjunto, re-etiqueta, pausa y activa
//   node scripts/meta-ads/apply.cjs --replace N2,N5 → cambia el creativo de anuncios existentes (vuelven a revisión)
//   node scripts/meta-ads/apply.cjs --previews U1,U2 → vistas previas solo de esas claves (sin claves = todas)
//   node scripts/meta-ads/apply.cjs --status ACTIVE U1,U2 → activa/pausa solo esas claves (no toca el resto)
//   node scripts/meta-ads/apply.cjs --create T1,T2 → crea solo esas claves (con `test_adset`: crea antes la campaña ABO y el conjunto, en PAUSA)
//   node scripts/meta-ads/apply.cjs --catalog N3,Banner → prende el catálogo en anuncios ya publicados (vuelven a revisión)
//   node scripts/meta-ads/apply.cjs --test-status ACTIVE t1,t2 → activa/pausa conjuntos de plan.test (al activar, también la campaña de prueba)
// --activate NO es idempotente (re-etiqueta y reactiva todo): para correcciones usar --replace.
// Guarda IDs creados en .out/state.json para ser idempotente.
const fs = require('fs');
const path = require('path');
const { get, post, upload, all, ACCOUNT, PAGE_ID, IG_ID } = require('./metaApi.cjs');

const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan.json'), 'utf8'));
const OUT = path.join(__dirname, '.out');
const STATE = path.join(OUT, 'state.json');
fs.mkdirSync(OUT, { recursive: true });
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { images: {}, video: null, creatives: {}, ads: {} };
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
const mode = process.argv[2] || '--dry';

const FEED = { facebook_positions: ['feed', 'profile_feed', 'instream_video'], instagram_positions: ['stream', 'profile_feed', 'explore_home', 'ig_search'] };
const VERT = { facebook_positions: ['story', 'facebook_reels'], instagram_positions: ['story', 'reels'] };
// Mejoras automáticas que alteran el diseño o el texto: apagadas.
const DOF = { creative_features_spec: Object.fromEntries(
  ['image_templates', 'image_animation', 'text_optimizations', 'product_extensions', 'image_uncrop', 'image_background_gen']
    .map((f) => [f, { enroll_status: 'OPT_OUT' }]),
) };
// Catálogo bajo el anuncio: `ad.catalog` es un ID de conjunto de productos o `true` para plan.catalog_set. Meta no lo permite en carruseles.
function catalogFields(catalog) {
  if (!catalog) return { degrees_of_freedom_spec: DOF };
  const product_extensions = { enroll_status: 'OPT_IN', action_metadata: { type: 'MANUAL' }, customizations: { pe_carousel: { enroll_status: 'OPT_IN' } } };
  return {
    degrees_of_freedom_spec: { creative_features_spec: { ...DOF.creative_features_spec, product_extensions } },
    creative_sourcing_spec: { associated_product_set_id: catalog === true ? plan.catalog_set : catalog },
  };
}

async function uploadImage(file) {
  if (state.images[file]) return state.images[file];
  const bytes = fs.readFileSync(path.join(plan.creatives_dir, file)).toString('base64');
  const r = await post(`${ACCOUNT}/adimages`, { bytes, name: path.basename(file) });
  const hash = Object.values(r.images)[0].hash;
  state.images[file] = hash; save();
  console.log(`  imagen ${file} → ${hash}`);
  return hash;
}

// Video por anuncio (`ad.video`, ruta absoluta) o el legado `plan.video_src` (N5).
async function uploadVideo(ad) {
  state.videos ??= {};
  if (!ad.video && state.video) return state.video;
  if (ad.video && state.videos[ad.key]) return state.videos[ad.key];
  const src = ad.video || plan.video_src;
  const type = src.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  const source = new File([fs.readFileSync(src)], path.basename(src), { type });
  const r = await upload(`${ACCOUNT}/advideos`, { source, name: ad.name });
  for (let i = 0; i < 30; i++) {
    const v = await get(r.id, { fields: 'status' });
    if (v.status?.video_status === 'ready') break;
    await new Promise((res) => setTimeout(res, 5000));
  }
  const thumbs = await get(`${r.id}/thumbnails`, { fields: 'uri,is_preferred' });
  const v = { id: r.id, thumb: (thumbs.data.find((t) => t.is_preferred) || thumbs.data[0])?.uri };
  if (ad.video) state.videos[ad.key] = v; else state.video = v;
  save();
  console.log(`  video → ${r.id}`);
  return v;
}

const cta = (link) => ({ type: 'SHOP_NOW', value: { link } });
const identity = () => ({ page_id: PAGE_ID, instagram_user_id: IG_ID });

async function creativeSpec(ad) {
  if (ad.type === 'placement_image') {
    const [hf, hv] = [await uploadImage(ad.feed), await uploadImage(ad.vertical)];
    return {
      object_story_spec: identity(),
      asset_feed_spec: {
        images: [{ hash: hf, adlabels: [{ name: `${ad.key}_feed` }] }, { hash: hv, adlabels: [{ name: `${ad.key}_vert` }] }],
        bodies: [{ text: ad.body }],
        titles: [{ text: ad.title }],
        descriptions: [{ text: 'Pagas al recibir' }],
        link_urls: [{ website_url: ad.link }],
        call_to_action_types: ['SHOP_NOW'],
        ad_formats: ['SINGLE_IMAGE'],
        optimization_type: 'PLACEMENT',
        asset_customization_rules: [
          { customization_spec: { publisher_platforms: ['facebook', 'instagram'], ...FEED }, image_label: { name: `${ad.key}_feed` }, priority: 1 },
          { customization_spec: { publisher_platforms: ['facebook', 'instagram'], ...VERT }, image_label: { name: `${ad.key}_vert` }, priority: 2 },
        ],
      },
    };
  }
  if (ad.type === 'placement_video') {
    const [vf, vv] = [await uploadVideo({ ...ad, key: `${ad.key}_feed`, video: ad.feed_video }), await uploadVideo({ ...ad, key: `${ad.key}_vert`, video: ad.vertical_video })];
    return {
      object_story_spec: identity(),
      asset_feed_spec: {
        videos: [{ video_id: vf.id, thumbnail_url: vf.thumb, adlabels: [{ name: `${ad.key}_feed` }] }, { video_id: vv.id, thumbnail_url: vv.thumb, adlabels: [{ name: `${ad.key}_vert` }] }],
        bodies: [{ text: ad.body }],
        titles: [{ text: ad.title }],
        descriptions: [{ text: 'Pagas al recibir' }],
        link_urls: [{ website_url: ad.link }],
        call_to_action_types: ['SHOP_NOW'],
        ad_formats: ['SINGLE_VIDEO'],
        optimization_type: 'PLACEMENT',
        asset_customization_rules: [
          { customization_spec: { publisher_platforms: ['facebook', 'instagram'], ...FEED }, video_label: { name: `${ad.key}_feed` }, priority: 1 },
          { customization_spec: { publisher_platforms: ['facebook', 'instagram'], ...VERT }, video_label: { name: `${ad.key}_vert` }, priority: 2 },
        ],
      },
    };
  }
  if (ad.type === 'carousel') {
    const cards = [];
    for (const f of ad.cards) cards.push({ image_hash: await uploadImage(f), link: ad.link, name: ad.title, call_to_action: cta(ad.link) });
    return { object_story_spec: { ...identity(), link_data: { link: ad.link, message: ad.body, child_attachments: cards, multi_share_optimized: false, multi_share_end_card: false, call_to_action: cta(ad.link) } } };
  }
  if (ad.type === 'video') {
    const v = await uploadVideo(ad);
    return { object_story_spec: { ...identity(), video_data: { video_id: v.id, image_url: v.thumb, message: ad.body, title: ad.title, link_description: 'Pagas al recibir', call_to_action: cta(ad.link) } } };
  }
  if (ad.type === 'clone') {
    // Copia el spec de un creativo existente → Meta genera un post nuevo (sirve si el post original quedó oculto).
    const { object_story_spec, asset_feed_spec } = await get(ad.source_creative, { fields: 'object_story_spec,asset_feed_spec' });
    return { object_story_spec, ...(asset_feed_spec ? { asset_feed_spec } : {}) };
  }
  throw new Error(`tipo desconocido ${ad.type}`);
}

// Campaña ABO de prueba (plan.test): copia público y optimización del conjunto principal, sin modificarlo.
async function testAdset(key) {
  state.test ??= { campaign: null, adsets: {} };
  if (state.test.adsets[key]) return state.test.adsets[key];
  const def = plan.test.adsets.find((s) => s.key === key);
  if (!def) throw new Error(`conjunto de prueba desconocido ${key}`);
  if (!state.test.campaign) {
    const c = await post(`${ACCOUNT}/campaigns`, { name: plan.test.name, objective: 'OUTCOME_SALES', status: 'PAUSED', special_ad_categories: [], is_adset_budget_sharing_enabled: false });
    state.test.campaign = c.id; save();
    console.log(`  campaña ABO ${c.id} (PAUSA)`);
  }
  const base = await get(plan.adset.id, { fields: 'targeting,promoted_object,billing_event,optimization_goal,attribution_spec' });
  const { pixel_id, custom_event_type } = base.promoted_object;
  const s = await post(`${ACCOUNT}/adsets`, {
    name: def.name, campaign_id: state.test.campaign, daily_budget: def.daily_budget, status: 'PAUSED', bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    billing_event: base.billing_event, optimization_goal: base.optimization_goal, promoted_object: { pixel_id, custom_event_type },
    targeting: base.targeting, attribution_spec: base.attribution_spec,
  });
  state.test.adsets[key] = s.id; save();
  console.log(`  conjunto ${def.name} ${s.id} (PAUSA, ${def.daily_budget}/día)`);
  return s.id;
}

// Prende el catálogo en anuncios ya publicados, guardando el creativo previo para revertir.
// Conserva el post (likes y comentarios) y el asset_feed_spec con la regla use_existing_post; si Meta lo rechaza, copia el spec y queda un post nuevo.
async function enableCatalog(keys) {
  state.prev_creatives ??= {};
  const listed = await all(`${ACCOUNT}/ads`, { fields: 'id,name', effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'PENDING_REVIEW', 'IN_PROCESS']) });
  for (const key of keys) {
    const adId = state.ads[key] ?? plan.new_ads.find((x) => x.key === key)?.ad_id ?? listed.find((a) => a.name.startsWith(key))?.id;
    if (!adId) { console.log(`! sin anuncio para ${key}`); continue; }
    const { name, creative: cur } = await get(adId, { fields: 'name,creative{id,effective_object_story_id,asset_feed_spec,object_story_spec}' });
    const common = { name: `${name} (catálogo)`, url_tags: plan.url_tags, ...catalogFields(true) };
    const samePost = { object_story_id: cur.effective_object_story_id, ...(cur.asset_feed_spec ? { asset_feed_spec: { ...cur.asset_feed_spec, target_rules: [{ use_existing_post: true }] } } : {}) };
    let c; let kept = true;
    try {
      c = await post(`${ACCOUNT}/adcreatives`, { ...common, ...samePost });
    } catch (e) {
      console.log(`  ${key}: no aceptó el mismo post (${e.message.slice(0, 120)})`);
      c = await post(`${ACCOUNT}/adcreatives`, { ...common, object_story_spec: cur.object_story_spec, ...(cur.asset_feed_spec ? { asset_feed_spec: cur.asset_feed_spec } : {}) });
      kept = false;
    }
    state.prev_creatives[key] ??= cur.id; save();
    await post(adId, { creative: { creative_id: c.id } });
    console.log(`catálogo → ${key}: ${cur.id} → ${c.id} (${kept ? 'mismo post' : 'post nuevo'})`);
  }
}

// Solo plan.test: nunca toca la campaña ni el conjunto principal.
async function setTestStatus(status, keys) {
  if (!['ACTIVE', 'PAUSED'].includes(status)) throw new Error(`estado inválido ${status}`);
  if (status === 'ACTIVE') { await post(state.test.campaign, { status }); console.log(`${status} → campaña ${state.test.campaign}`); }
  for (const key of keys) {
    const id = state.test.adsets[key];
    if (!id) { console.log(`! sin conjunto para ${key}`); continue; }
    await post(id, { status });
    console.log(`${status} → conjunto ${key} ${id}`);
  }
}

async function create(keys) {
  for (const ad of plan.new_ads) {
    if (ad.ad_id) continue; // anuncio existente: se corrige con --replace
    if (keys.length && !keys.includes(ad.key)) continue;
    if (state.ads[ad.key]) { console.log(`= ${ad.name} ya existe (${state.ads[ad.key]})`); continue; }
    console.log(`+ ${ad.name}`);
    const adsetId = ad.test_adset ? await testAdset(ad.test_adset) : plan.adset.id;
    const spec = await creativeSpec(ad);
    const c = await post(`${ACCOUNT}/adcreatives`, { name: ad.name, ...spec, url_tags: plan.url_tags, ...catalogFields(ad.catalog) });
    state.creatives[ad.key] = c.id; save();
    const a = await post(`${ACCOUNT}/ads`, { name: ad.name, adset_id: adsetId, creative: { creative_id: c.id }, status: 'PAUSED' });
    state.ads[ad.key] = a.id; save();
    console.log(`  creativo ${c.id} · anuncio ${a.id} (PAUSA)`);
  }
}

// Cambia el creativo de anuncios ya creados (reenvía a revisión; conserva el ID del anuncio y su estado).
async function replace(keys) {
  for (const key of keys) {
    const ad = plan.new_ads.find((x) => x.key === key);
    const adId = state.ads[key] ?? ad?.ad_id;
    if (!ad || !adId) { console.log(`! sin anuncio para ${key}`); continue; }
    const spec = await creativeSpec(ad);
    const c = await post(`${ACCOUNT}/adcreatives`, { name: `${ad.name} (fix)`, ...spec, url_tags: plan.url_tags, ...catalogFields(ad.catalog) });
    await post(adId, { creative: { creative_id: c.id } });
    state.creatives[key] = c.id; save();
    console.log(`~ ${ad.name}: creativo ${c.id} → anuncio ${adId}`);
  }
}

// Cambia el estado solo de los anuncios indicados (alternativa idempotente a --activate).
async function setStatus(status, keys) {
  if (!['ACTIVE', 'PAUSED'].includes(status)) throw new Error(`estado inválido ${status}`);
  for (const key of keys) {
    const id = state.ads[key] ?? plan.new_ads.find((x) => x.key === key)?.ad_id;
    if (!id) { console.log(`! sin anuncio para ${key}`); continue; }
    await post(id, { status });
    console.log(`${status} → ${key} ${id}`);
  }
}

async function previews(keys) {
  const formats = ['INSTAGRAM_STANDARD', 'INSTAGRAM_STORY', 'INSTAGRAM_REELS', 'MOBILE_FEED_STANDARD'];
  let html = '<!doctype html><meta charset="utf-8"><title>Vistas previas</title><body style="font-family:sans-serif">';
  for (const ad of plan.new_ads) {
    const id = state.ads[ad.key];
    if (!id || (keys.length && !keys.includes(ad.key))) continue;
    html += `<h2>${ad.name}</h2><div style="display:flex;gap:12px;flex-wrap:wrap">`;
    for (const f of formats) {
      const r = await get(`${id}/previews`, { ad_format: f }).catch((e) => ({ error: e.message }));
      html += `<div><p>${f}</p>${r.data?.[0]?.body || `<pre>${r.error || 'sin vista'}</pre>`}</div>`;
    }
    html += '</div>';
  }
  fs.writeFileSync(path.join(OUT, 'previews.html'), html);
  console.log(`previews → ${path.join(OUT, 'previews.html')}`);
}

async function activate() {
  const t = (await get(plan.adset.id, { fields: 'targeting' })).targeting;
  const p = plan.adset.targeting_patch;
  const targeting = { ...t, ...p };
  if (p.genders === null) delete targeting.genders;
  targeting.targeting_automation = { advantage_audience: 1, individual_setting: { age: 1 } };
  await post(plan.adset.id, { name: plan.adset.rename, targeting });
  console.log(`conjunto ${plan.adset.id} → "${plan.adset.rename}"`);

  const ads = await all(`${ACCOUNT}/ads`, { fields: 'id,name,adset_id,creative{effective_object_story_id}', effective_status: JSON.stringify(['ACTIVE', 'PAUSED']) });
  for (const name of plan.retag_ads) {
    const a = ads.find((x) => x.name === name && x.adset_id === plan.adset.id);
    if (!a) { console.log(`! no encontrado ${name}`); continue; }
    const c = await post(`${ACCOUNT}/adcreatives`, { name: `${name} (utm)`, object_story_id: a.creative.effective_object_story_id, url_tags: plan.url_tags });
    await post(a.id, { creative: { creative_id: c.id } });
    console.log(`utm → ${name}`);
  }
  for (const name of plan.pause_ads) {
    for (const a of ads.filter((x) => x.name === name)) { await post(a.id, { status: 'PAUSED' }); console.log(`pausa → ${name}`); }
  }
  for (const id of plan.pause_adsets) { await post(id, { status: 'PAUSED' }); console.log(`pausa conjunto → ${id}`); }
  for (const [k, id] of Object.entries(state.ads)) { await post(id, { status: 'ACTIVE' }); console.log(`activo → ${k} ${id}`); }
}

(async () => {
  if (mode === '--dry') {
    console.log(`Conjunto ${plan.adset.id} → "${plan.adset.rename}" · targeting ${JSON.stringify(plan.adset.targeting_patch)}`);
    console.log(`Pausar conjuntos: ${plan.pause_adsets} · anuncios: ${plan.pause_ads} · UTM a: ${plan.retag_ads}`);
    if (plan.test) console.log(`Campaña ABO "${plan.test.name}"${state.test?.campaign ? ` (ya creada ${state.test.campaign})` : ''} · conjuntos: ${plan.test.adsets.map((s) => `${s.key}=${s.name} ${s.daily_budget}/día`).join(' · ')}`);
    for (const ad of plan.new_ads) console.log(`+ ${ad.name} [${ad.type}] conjunto ${ad.test_adset ?? 'principal'} → ${ad.link ?? ad.source_creative}${state.ads[ad.key] || ad.ad_id ? ` (ya creado ${state.ads[ad.key] ?? ad.ad_id})` : ''}\n    "${ad.title ?? ''}" | ${(ad.body ?? '').replace(/\n/g, ' / ')}`);
    return;
  }
  if (mode === '--create') return create((process.argv[3] || '').split(',').filter(Boolean));
  if (mode === '--catalog') return enableCatalog((process.argv[3] || '').split(',').filter(Boolean));
  if (mode === '--test-status') return setTestStatus(process.argv[3], (process.argv[4] || '').split(',').filter(Boolean));
  if (mode === '--replace') return replace((process.argv[3] || '').split(',').filter(Boolean));
  if (mode === '--previews') return previews((process.argv[3] || '').split(',').filter(Boolean));
  if (mode === '--status') return setStatus(process.argv[3], (process.argv[4] || '').split(',').filter(Boolean));
  if (mode === '--activate') return activate();
  throw new Error(`modo desconocido ${mode}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
