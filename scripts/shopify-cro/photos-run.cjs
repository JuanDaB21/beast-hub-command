// Genera, revisa y sube las fotos de catálogo definidas en photos-plan.json.
// Uso:
//   node scripts/shopify-cro/photos-run.cjs --estimate [tanda|handles]   créditos que costaría (no gasta)
//   node scripts/shopify-cro/photos-run.cjs --generate <tanda|handles>   genera y descarga a .out/nightjar/<handle>/
//   node scripts/shopify-cro/photos-run.cjs --sheet <tanda|handles>      hoja de contacto en .out/nightjar/sheet-<x>.jpg
//   node scripts/shopify-cro/photos-run.cjs --upload <tanda|handles> [--apply]   sube a Shopify (sin --apply: solo plan)
// Selección: nombre de tanda (p. ej. CP2) o handles separados por coma.
// Rehacer una foto: subir `rev` en la entrada (producto Nightjar nuevo con refs/descripción nuevas), darle a la toma
// una `key` nueva y `replaces: "<key vieja>"`; al subir con --apply las fotos de la toma vieja se desvinculan.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const nj = require('./nightjar.cjs');
const plan = require('./photos-plan.json');

const [, , cmd, sel = ''] = process.argv;
const pick = () => plan.products.filter((p) => p.tanda === sel || sel.split(',').includes(p.handle));
const cost = (s) => (s.mode === 'photoshoot' ? 2 : (s.count ?? 1) * (plan.defaults.resolution === '4k' ? 2 : 1));
const resolveSrc = (src) => (/^https?:/.test(src) ? src : path.resolve(__dirname, src));

function body(p, s, productId) {
  const d = plan.defaults;
  const garment = plan.garments?.[p.garment] ?? p.garment;
  const directions = d.directions.replace('{garment}', garment).replace('{print}', p.print).replace('{extra}', s.extra ?? '')
    .replace('{outfit}', p.outfit ?? d.outfit);
  const b = {
    product_ids: [productId],
    photography_style_id: s.style ?? d.photography_style_id,
    background: s.background ?? d.background,
    fashion_model: s.no_model ? { type: 'none' } : { type: 'selected', fashion_model_id: plan.models[s.model ?? p.model] },
    custom_directions: directions.slice(0, 4000),
    aspect_ratio: d.aspect_ratio, resolution: d.resolution, output_format: d.output_format,
    output_mode: s.mode === 'photoshoot' ? 'photoshoot' : 'single_shots',
  };
  if (s.colorway) b.colorway = s.colorway;
  if (s.mode !== 'photoshoot') {
    b.image_count = s.count ?? 1;
    for (const k of ['pose_id', 'framing', 'shadow', 'camera_distance']) if (s[k]) b[k] = s[k];
  }
  return b;
}

// Una entrada del plan (producto + color) de principio a fin. Varias corren en paralelo sobre el mismo estado.
async function generateOne(state, p) {
  const assetIds = [];
  for (const r of p.refs) assetIds.push(await nj.assetFor(state, r.key, resolveSrc(r.src)));
  const garment = plan.garments?.[p.garment] ?? p.garment;
  // `rev` crea un producto Nightjar nuevo (con refs y descripción nuevas): el anterior queda cacheado por clave.
  const productId = await nj.productFor(state, `${p.handle}|${p.color}${p.rev ? `|v${p.rev}` : ''}`, {
    name: `${p.handle} · ${p.color}`, description: `${garment}. Print: ${p.print}`, assetIds });
  for (const s of p.shots) {
    const key = `${p.handle}|${s.key}`;
    if (state.gens[key]?.outputs?.length && !process.argv.includes('--force')) { console.log(`= ${key} ya generado`); continue; }
    console.log(`→ ${key} (${cost(s)} cr)…`);
    const g = await nj.generate(state, key, body(p, s, productId));
    let i = 0;
    for (const o of state.gens[key].outputs) {
      if (!o.url) console.log(`   ${key} salida ${i} falló: ${JSON.stringify(o.error)}`);
      else await nj.download(o.url, path.join(nj.OUT, p.handle, `${s.key}-${i}.webp`));
      i++;
    }
    console.log(`   ${key}: ${g.output_summary.completed}/${g.output_summary.total} ok, créditos ${JSON.stringify(g.credits)}`);
  }
}

async function generate(products) {
  const state = nj.loadState();
  const queue = [...products];
  const errors = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let p; (p = queue.shift());) {
      try { await generateOne(state, p); } catch (e) { errors.push(`${p.handle}|${p.color}: ${e.message}`); }
    }
  }));
  if (errors.length) console.log(`Errores:\n  ${errors.join('\n  ')}`);
  const team = await nj.get('/team');
  console.log(`Créditos restantes: ${team.credits}`);
}

function sheet(products) {
  const out = path.join(nj.OUT, `sheet-${sel.replace(/[^a-z0-9]+/gi, '_')}.jpg`);
  const py = `
import sys,os,glob
from PIL import Image,ImageDraw
out=sys.argv[1];rows=[]
for d in sys.argv[2:]:
    fs=sorted(glob.glob(os.path.join(d,'*.webp')))
    if fs: rows.append((os.path.basename(d),fs))
W,H=300,375;cols=max([len(f) for _,f in rows]+[1])
S=Image.new('RGB',(cols*W,len(rows)*(H+18)),'white');dr=ImageDraw.Draw(S)
for r,(name,fs) in enumerate(rows):
    for i,f in enumerate(fs):
        im=Image.open(f).convert('RGB');im.thumbnail((W-4,H-4));S.paste(im,(i*W+2,r*(H+18)+16))
    dr.text((4,r*(H+18)),name,fill='red')
S.save(out,quality=85)`;
  execFileSync('python', ['-c', py, out, ...[...new Set(products.map((p) => path.join(nj.OUT, p.handle)))]],{ stdio: 'inherit' });
  console.log(out);
}

// ── Subida a Shopify ─────────────────────────────────────────────────────────
// Orden final de la galería: fotos de la sesión principal (portada primero) → una por color extra → fotos viejas.
// Cada color queda enlazado a su foto. Las fotos viejas no se borran. Sin --apply solo muestra el plan.
// Una toma se puede excluir con "reject": [índices] en el plan.
const VIEW = { espalda: 'espalda', frente: 'frente' };
function viewsFor(s) {
  if (s.views) return s.views;
  const backFirst = /^(Single frame: back|Two frames: \(1\) back|Four frames[^:]*: back)/.test(s.extra || '');
  if (s.mode === 'photoshoot') return backFirst ? ['espalda', 'frente', 'tres cuartos', 'detalle del estampado'] : ['frente', 'espalda', 'tres cuartos', 'detalle del estampado'];
  if ((s.count ?? 1) === 2) return backFirst ? [VIEW.espalda, VIEW.frente] : [VIEW.frente, VIEW.espalda];
  return [backFirst ? VIEW.espalda : VIEW.frente];
}

const PRODUCT_Q = `query($h:String!){ productByHandle(handle:$h){ id title productType status
  media(first:100){ nodes{ id alt status mediaContentType } }
  variants(first:100){ nodes{ id selectedOptions{ name value } media(first:1){ nodes{ id } } } } } }`;

async function upload(entries) {
  const { gql } = require('./shopifyCro.cjs');
  const apply = process.argv.includes('--apply');
  const state = nj.loadState();
  state.uploads ??= {};
  const byHandle = new Map();
  for (const p of entries) byHandle.set(p.handle, [...(byHandle.get(p.handle) || []), p]);
  for (const [handle, list] of byHandle) {
    const prod = (await gql(PRODUCT_Q, { h: handle })).productByHandle;
    if (!prod) { console.log(`✗ ${handle}: no existe`); continue; }
    if (/pack/i.test(prod.productType)) { console.log(`✗ ${handle}: es un pack, no se toca`); continue; }
    // Fotos nuevas en orden: entradas con photoshoot primero, luego singles, respetando el orden del plan.
    const items = [];
    const ordered = [...list].sort((a, b) => (b.shots.some((s) => s.mode === 'photoshoot') ? 1 : 0) - (a.shots.some((s) => s.mode === 'photoshoot') ? 1 : 0));
    for (const p of ordered) for (const s of p.shots) {
      const gen = state.gens[`${handle}|${s.key}`];
      if (!gen?.outputs?.length) { console.log(`  ! ${handle}|${s.key} sin generar`); continue; }
      const views = viewsFor(s);
      let first = true; // portada del color = primera salida no rechazada
      gen.outputs.forEach((o, i) => {
        if (!o.asset_id || (s.reject || []).includes(i)) return;
        items.push({ key: `${handle}|${s.key}|${i}`, asset: o.asset_id, color: p.color, hero: first,
          alt: `${prod.title} – ${p.color.replace(/\s+/g, ' ').trim()} – ${views[i] ?? 'detalle'}` });
        first = false;
      });
    }
    const pending = items.filter((it) => !state.uploads[it.key]);
    // Tomas reemplazadas (`replaces` en el plan): sus fotos ya subidas se desvinculan del producto.
    const live = new Set(prod.media.nodes.map((n) => n.id));
    const retire = list.flatMap((p) => p.shots.filter((s) => s.replaces).flatMap((s) =>
      Object.entries(state.uploads).filter(([k, id]) => k.startsWith(`${handle}|${s.replaces}|`) && live.has(id)).map(([k, id]) => ({ key: k, id }))));
    console.log(`\n${handle} (${prod.status}): ${items.length} fotos nuevas (${pending.length} por subir), ${prod.media.nodes.length} viejas, ${retire.length} a desvincular`);
    for (const it of items) console.log(`  ${state.uploads[it.key] ? '=' : '+'} ${it.alt}`);
    for (const r of retire) console.log(`  - ${r.key}`);
    if (!apply) continue;

    // Desvincular (el archivo queda en Contenido › Archivos; se revierte con referencesToAdd).
    if (retire.length) {
      const r = await gql(`mutation($f:[FileUpdateInput!]!){ fileUpdate(files:$f){ userErrors{ field message } } }`,
        { f: retire.map((x) => ({ id: x.id, referencesToRemove: [prod.id] })) });
      if (r.fileUpdate.userErrors.length) throw new Error(`${handle}: ${JSON.stringify(r.fileUpdate.userErrors)}`);
      state.retired ??= {};
      for (const x of retire) state.retired[x.key] = x.id;
      nj.saveState(state);
    }

    if (pending.length) {
      const media = [];
      for (const it of pending) media.push({ originalSource: (await nj.get(`/assets/${it.asset}`)).url, alt: it.alt, mediaContentType: 'IMAGE' });
      const r = await gql(`mutation($p:ProductUpdateInput!,$m:[CreateMediaInput!]){ productUpdate(product:$p, media:$m){
        product{ media(first:250){ nodes{ id alt } } } userErrors{ field message } } }`, { p: { id: prod.id }, m: media });
      const errs = r.productUpdate.userErrors;
      if (errs.length) throw new Error(`${handle}: ${JSON.stringify(errs)}`);
      const known = new Set(prod.media.nodes.map((n) => n.id));
      for (const it of pending) {
        const m = r.productUpdate.product.media.nodes.find((n) => n.alt === it.alt && !known.has(n.id));
        if (!m) throw new Error(`${handle}: no encuentro la media creada para "${it.alt}"`);
        known.add(m.id);
        state.uploads[it.key] = m.id;
      }
      nj.saveState(state);
    }

    // Esperar a que Shopify procese las imágenes (hace falta para enlazarlas a variantes).
    const ids = items.map((it) => state.uploads[it.key]);
    let cur;
    for (let t = 0; t < 30; t++) {
      cur = (await gql(PRODUCT_Q, { h: handle })).productByHandle;
      const st = new Map(cur.media.nodes.map((n) => [n.id, n.status]));
      if (ids.some((id) => st.get(id) === 'FAILED')) throw new Error(`${handle}: Shopify no pudo procesar una imagen`);
      if (ids.every((id) => st.get(id) === 'READY')) break;
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Orden: nuevas primero en el orden de `items`; las viejas conservan su orden relativo después.
    // Si el producto solo recibió fotos de colores extra (sin sesión principal), no se le cambia la portada:
    // las nuevas quedan al final y solo se enlazan a su color.
    const hasShoot = list.some((p) => p.shots.some((s) => s.mode === 'photoshoot'));
    if (hasShoot) {
      const moves = ids.map((id, i) => ({ id, newPosition: String(i) }));
      const ro = await gql(`mutation($id:ID!,$m:[MoveInput!]!){ productReorderMedia(id:$id, moves:$m){ mediaUserErrors{ field message } } }`, { id: prod.id, m: moves });
      if (ro.productReorderMedia.mediaUserErrors.length) throw new Error(`${handle}: ${JSON.stringify(ro.productReorderMedia.mediaUserErrors)}`);
    }

    // Cada variante apunta a la portada de su color.
    const norm = (x) => x.replace(/\s+/g, ' ').replace(/ ?\/ ?/g, '/').trim().toLowerCase();
    const heroByColor = new Map();
    for (const it of items) if (it.hero && !heroByColor.has(norm(it.color))) heroByColor.set(norm(it.color), state.uploads[it.key]);
    const vars = cur.variants.nodes.flatMap((v) => {
      const c = v.selectedOptions.find((o) => /color/i.test(o.name))?.value;
      const mediaId = c && heroByColor.get(norm(c));
      return mediaId && v.media.nodes[0]?.id !== mediaId ? [{ id: v.id, mediaId }] : [];
    });
    if (vars.length) {
      const vr = await gql(`mutation($p:ID!,$v:[ProductVariantsBulkInput!]!){ productVariantsBulkUpdate(productId:$p, variants:$v){ userErrors{ field message } } }`, { p: prod.id, v: vars });
      if (vr.productVariantsBulkUpdate.userErrors.length) throw new Error(`${handle}: ${JSON.stringify(vr.productVariantsBulkUpdate.userErrors)}`);
    }
    console.log(`  ✓ subidas ${pending.length}, orden aplicado, ${vars.length} variantes enlazadas`);
  }
}

(async () => {
  const products = pick();
  if (!products.length) throw new Error(`Nada seleccionado con "${sel}"`);
  if (cmd === '--estimate') {
    let t = 0;
    for (const p of products) for (const s of p.shots) { t += cost(s); console.log(`${p.handle}|${s.key}: ${cost(s)}`); }
    console.log(`Total: ${t} créditos (disponibles: ${(await nj.get('/team')).credits})`);
  } else if (cmd === '--generate') await generate(products);
  else if (cmd === '--sheet') sheet(products);
  // La galería se arma por producto: incluye todas las entradas del plan de esos handles, de cualquier tanda.
  else if (cmd === '--upload') await upload(plan.products.filter((p) => products.some((q) => q.handle === p.handle)));
  else throw new Error('Comando: --estimate | --generate | --sheet | --upload [--apply]');
})().catch((e) => { console.error(e.message); process.exit(1); });
