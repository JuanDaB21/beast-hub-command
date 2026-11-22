// Curaduría de galerías: portada del color más vendido (del lado del estampado), limpieza de fotos viejas
// de colores que ya tienen foto nueva y enlace color↔foto. Ver docs/marketing/FOTOS_CATALOGO_2026-11.md.
//   node scripts/shopify-cro/photos-curate.cjs --classify     arma/actualiza photos-curation.json (no escribe en Shopify)
//   node scripts/shopify-cro/photos-curate.cjs --sheet        hoja de contacto de fotos viejas sin clasificar
//   node scripts/shopify-cro/photos-curate.cjs --plan         galería final por producto + hojas (dry-run)
//   node scripts/shopify-cro/photos-curate.cjs --apply        reordena, re-enlaza y desvincula (reversible)
// En photos-curation.json cada foto lleva color (valor exacto de la opción Color, o null), view
// (espalda|frente|tres cuartos|detalle|otra), isNew y, opcional, remove:true (prenda distinta a la real).
// Por producto: print_side (espalda|frente) y, opcional, winner (fuerza el color de portada).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gql } = require('./shopifyCro.cjs');
const nj = require('./nightjar.cjs');
const plan = require('./photos-plan.json');

const FILE = path.join(__dirname, 'photos-curation.json');
const OUT = path.join(__dirname, '.out', 'curation');
const cmd = process.argv[2];
// "Negro / Letras Verdes" y "Negro/ Letras Verdes" son el mismo color (la opción y el alt difieren en espacios).
const norm = (x) => String(x || '').replace(/\s+/g, ' ').replace(/ ?\/ ?/g, '/').trim().toLowerCase();
const VIEWS = ['espalda', 'frente', 'tres cuartos', 'detalle del estampado', 'detalle', 'otra'];

const PRODUCT_Q = `query($h:String!){ productByHandle(handle:$h){ id handle title productType status
  options{ name values }
  media(first:100){ nodes{ id alt status ... on MediaImage{ mimeType image{ url width height } } } }
  variants(first:100){ nodes{ id availableForSale selectedOptions{ name value } media(first:1){ nodes{ id } } } } } }`;

async function salesRows(since) {
  const q = `FROM sales SHOW net_items_sold GROUP BY product_title, product_variant_title SINCE ${since} UNTIL today ORDER BY net_items_sold DESC LIMIT 5000`;
  const r = (await gql(`query($q:String!){ shopifyqlQuery(query:$q){ parseErrors tableData{ columns{ name } rows } } }`, { q })).shopifyqlQuery;
  if (r.parseErrors?.length) throw new Error(JSON.stringify(r.parseErrors));
  const c = r.tableData.columns.map((x) => x.name);
  return r.tableData.rows.map((x) => (Array.isArray(x) ? Object.fromEntries(c.map((k, i) => [k, x[i]])) : x));
}

// Unidades por color (90 d y 2 años) y color ganador según la regla del plan.
function scoreColors(p, colorOpt, s90, s730, currentHeroColor) {
  const sellable = new Set(p.variants.nodes.filter((v) => v.availableForSale).map((v) => v.selectedOptions.find((o) => o.name === colorOpt.name).value));
  const units = (rows) => {
    const u = Object.fromEntries(colorOpt.values.map((c) => [c, 0]));
    for (const r of rows) if (r.product_title === p.title) {
      const vt = norm(r.product_variant_title);
      // La coincidencia más larga gana: "Negro/Letras Blancas" también está dentro de "Acid Negro/Letras Blancas".
      const c = colorOpt.values.filter((x) => vt.includes(norm(x))).sort((a, b) => norm(b).length - norm(a).length)[0];
      if (c) u[c] += Number(r.net_items_sold);
    }
    return u;
  };
  const u90 = units(s90), u730 = units(s730);
  const total90 = Object.values(u90).reduce((a, b) => a + b, 0);
  const score = total90 >= 3 ? u90 : u730;
  const cands = colorOpt.values.filter((c) => sellable.has(c));
  const ranked = [...cands].sort((a, b) => (score[b] - score[a]) || ((b === currentHeroColor) - (a === currentHeroColor)) || (u730[b] - u730[a]));
  // Empate con la portada actual: se mantiene la actual.
  let winner = ranked[0];
  if (currentHeroColor && cands.includes(currentHeroColor) && score[currentHeroColor] === score[winner]) winner = currentHeroColor;
  return { u90, u730, ranked, winner, sellable: [...sellable] };
}

function loadCuration() { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {}; }
function saveCuration(c) { fs.writeFileSync(FILE, JSON.stringify(c, null, 2) + '\n'); }

function oldestSnapshot() {
  const d = path.join(__dirname, '.out');
  const f = fs.readdirSync(d).filter((x) => /^snapshot-\d/.test(x)).sort()[0];
  return JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
}

async function activeProducts() {
  const out = [];
  let after = null;
  do {
    const r = await gql(`query($a:String){ products(first:50, after:$a, query:"status:active"){ pageInfo{ hasNextPage endCursor }
      nodes{ handle productType options{ name values } media(first:1){ nodes{ id } }
      variants(first:100){ nodes{ availableForSale selectedOptions{ name value } media(first:1){ nodes{ id } } } } } } }`, { a: after });
    out.push(...r.products.nodes);
    after = r.products.pageInfo.hasNextPage ? r.products.pageInfo.endCursor : null;
  } while (after);
  return out;
}

// ── --classify ───────────────────────────────────────────────────────────────
async function classify() {
  const cur = loadCuration();
  const state = nj.loadState();
  const uploaded = new Map(Object.entries(state.uploads || {}).map(([k, id]) => [id, k]));
  const snap = oldestSnapshot();
  const snapLink = new Map(); // mediaId → color según el snapshot previo a la fase 1
  for (const p of snap) for (const v of p.variants?.nodes || p.variants || []) {
    const c = v.selectedOptions.find((o) => /color/i.test(o.name))?.value;
    const m = v.media?.nodes?.[0]?.id;
    if (c && m && !snapLink.has(m)) snapLink.set(m, c);
  }
  const [s90, s730] = [await salesRows('-90d'), await salesRows('-730d')];

  // Alcance: los productos del plan + activos (no pack, ≥2 colores, con algo vendible). Más abajo, con las ventas,
  // se descartan los de fuera del plan cuya portada ya es del color ganador.
  const planHandles = new Set(plan.products.map((p) => p.handle));
  const scope = new Set(planHandles);
  for (const p of await activeProducts()) {
    if (/pack/i.test(p.productType)) continue;
    const co = p.options.find((o) => /color/i.test(o.name));
    if (co && co.values.length >= 2 && p.variants.nodes.some((v) => v.availableForSale)) scope.add(p.handle);
  }

  let unresolved = 0;
  for (const h of scope) {
    const p = (await gql(PRODUCT_Q, { h })).productByHandle;
    if (!p || /pack/i.test(p.productType)) continue;
    const co = p.options.find((o) => /color/i.test(o.name));
    if (!co) continue;
    const linkNow = new Map();
    for (const v of p.variants.nodes) {
      const m = v.media.nodes[0]?.id;
      if (m && !linkNow.has(m)) linkNow.set(m, v.selectedOptions.find((o) => o.name === co.name).value);
    }
    const heroColor = linkNow.get(p.media.nodes[0]?.id) || null;
    const sc = scoreColors(p, co, s90, s730, heroColor);
    const inPlan = planHandles.has(h);
    if (!inPlan && (co.values.length < 2 || (heroColor && heroColor === sc.winner))) continue; // fuera del plan y ya correcto
    const prev = cur[h] || {};
    const media = {};
    for (const m of p.media.nodes) {
      const old = prev.media?.[m.id];
      if (old?.manual) { media[m.id] = old; continue; }
      const isNew = uploaded.has(m.id);
      let color = null, view = null;
      if (isNew) {
        const parts = (m.alt || '').split(' – ');
        color = co.values.find((c) => norm(c) === norm(parts[1])) || null;
        view = parts[2] || null;
      } else {
        const fromLink = snapLink.get(m.id) || linkNow.get(m.id);
        color = fromLink && co.values.includes(fromLink) ? fromLink : (co.values.find((c) => norm(m.alt).includes(norm(c))) || null);
      }
      if (!isNew) unresolved += !color || !view ? 1 : 0;
      media[m.id] = { isNew, color, view, url: m.image?.url?.split('?')[0], mime: m.mimeType, ...(old?.remove ? { remove: true } : {}) };
    }
    const planEntry = plan.products.find((e) => e.handle === h && e.shots.some((s) => s.mode === 'photoshoot'));
    const sideFromPlan = planEntry ? (/back view full body with/.test(planEntry.shots.find((s) => s.mode === 'photoshoot').extra) ? 'espalda' : 'frente') : null;
    cur[h] = {
      title: p.title, colors: co.values, sellable: sc.sellable, units90: sc.u90, units730: sc.u730,
      winner_auto: sc.winner, ...(prev.winner ? { winner: prev.winner } : {}),
      print_side: prev.print_side || sideFromPlan || null, in_plan: inPlan, media,
    };
  }
  saveCuration(cur);
  console.log(`${Object.keys(cur).length} productos en photos-curation.json; fotos viejas sin color o vista: ${unresolved}`);
}

// ── Hojas de contacto ────────────────────────────────────────────────────────
function contactSheet(rows, out) {
  // rows: [{label, items:[{url, caption, red}]}]
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(OUT, 'sheet-input.json');
  fs.writeFileSync(tmp, JSON.stringify(rows));
  const py = `
import sys,json,io,urllib.request
from PIL import Image,ImageDraw
rows=json.load(open(sys.argv[1],encoding='utf8'));out=sys.argv[2]
W,H=170,212;cols=max([len(r['items']) for r in rows]+[1])
S=Image.new('RGB',(cols*W,len(rows)*(H+30)),'white');d=ImageDraw.Draw(S)
for ri,r in enumerate(rows):
    y=ri*(H+30);d.text((3,y),r['label'][:150],fill=(0,0,160))
    for i,it in enumerate(r['items']):
        try:
            req=urllib.request.Request(it['url']+'?width=340',headers={'User-Agent':'Mozilla/5.0'})
            im=Image.open(io.BytesIO(urllib.request.urlopen(req,timeout=30).read())).convert('RGB');im.thumbnail((W-6,H-6))
            S.paste(im,(i*W+3,y+14))
        except Exception as e: d.text((i*W+3,y+40),'ERR',fill='red')
        if it.get('red'): d.rectangle([i*W+2,y+13,i*W+W-3,y+13+H-4],outline='red',width=4)
        d.text((i*W+3,y+14+H-6),it['caption'][:30],fill='red' if it.get('red') else 'black')
S.save(out,quality=80)`;
  execFileSync('python', ['-c', py, tmp, out], { stdio: 'inherit' });
  return out;
}

function sheetUnresolved() {
  const cur = loadCuration();
  const rows = [];
  for (const [h, p] of Object.entries(cur)) {
    const items = Object.entries(p.media).filter(([, m]) => !m.isNew && !m.manual).map(([id, m], i) => ({
      url: m.url, caption: `${id.split('/').pop().slice(-5)} ${m.color ? m.color.slice(0, 14) : '?'}` }));
    if (items.length) rows.push({ label: `${h} · colores: ${p.colors.join(' | ')}`, items });
  }
  for (let i = 0; i < rows.length; i += 12) console.log(contactSheet(rows.slice(i, i + 12), path.join(OUT, `viejas-${i / 12 + 1}.jpg`)));
}

// ── Galería final (pura, a partir de la curaduría) ───────────────────────────
function galleryFor(p) {
  const winner = p.winner || p.winner_auto;
  const order = [...new Set([winner, ...Object.entries(p.units90).sort((a, b) => b[1] - a[1]).map(([c]) => c), ...p.colors])];
  const entries = Object.entries(p.media).map(([id, m]) => ({ id, ...m }));
  const newColors = new Set(entries.filter((m) => m.isNew).map((m) => m.color));
  const remove = entries.filter((m) => !m.isNew && (m.remove || (p.in_plan && m.color && newColors.has(m.color))));
  const keep = entries.filter((m) => !remove.includes(m));
  const viewRank = (m) => {
    if (m.view === p.print_side) return 0;
    const i = VIEWS.indexOf(m.view);
    return 1 + (i < 0 ? VIEWS.length : i);
  };
  const final = [];
  for (const c of order) {
    const ofColor = keep.filter((m) => m.color === c);
    const fresh = ofColor.filter((m) => m.isNew);
    const group = fresh.length ? fresh : ofColor;
    // La primera foto del grupo es la del lado del estampado; el resto conserva su orden actual.
    const lead = [...group].sort((a, b) => viewRank(a) - viewRank(b))[0];
    if (lead) final.push(lead, ...group.filter((m) => m !== lead));
    if (fresh.length) final.push(...ofColor.filter((m) => !m.isNew));
  }
  final.push(...keep.filter((m) => !final.includes(m))); // sin color asignado: al final
  return { winner, final, remove };
}

async function planOrApply(apply) {
  const cur = loadCuration();
  const log = [];
  const rows = [];
  let nRemove = 0, nHero = 0;
  for (const [h, p] of Object.entries(cur)) {
    const { winner, final, remove } = galleryFor(p);
    const live = (await gql(PRODUCT_Q, { h })).productByHandle;
    if (/pack/i.test(live.productType)) throw new Error(`${h} es un pack`);
    const liveIds = live.media.nodes.map((m) => m.id);
    const unknown = liveIds.filter((id) => !p.media[id]);
    if (unknown.length) throw new Error(`${h}: ${unknown.length} fotos nuevas en Shopify sin clasificar; correr --classify`);
    const heroChanged = liveIds[0] !== final[0]?.id;
    nRemove += remove.length; nHero += heroChanged ? 1 : 0;
    console.log(`\n${h}  ganador: ${winner} (90d ${JSON.stringify(p.units90)})  lado: ${p.print_side}`);
    console.log(`  portada: ${final[0]?.color} – ${final[0]?.view}${heroChanged ? '  (CAMBIA)' : ''}; fotos: ${liveIds.length} → ${final.length}; se quitan ${remove.length}`);
    rows.push({ label: `${h} · ganador ${winner} · ${final.length} fotos, quitar ${remove.length}`,
      items: [...final.map((m, i) => ({ url: m.url, caption: `${i + 1} ${(m.color || '?').slice(0, 12)} ${(m.view || '?').slice(0, 7)}` })),
        ...remove.map((m) => ({ url: m.url, caption: `X ${(m.color || '?').slice(0, 12)}`, red: true }))] });
    if (!apply) continue;

    const entry = { handle: h, productId: live.id, before: liveIds, removed: [], variants: [] };
    // 1) Desvincular (el archivo sigue en Contenido › Archivos; se revierte con referencesToAdd).
    if (remove.length) {
      const r = await gql(`mutation($f:[FileUpdateInput!]!){ fileUpdate(files:$f){ userErrors{ field message } } }`,
        { f: remove.map((m) => ({ id: m.id, referencesToRemove: [live.id] })) });
      if (r.fileUpdate.userErrors.length) throw new Error(`${h}: ${JSON.stringify(r.fileUpdate.userErrors)}`);
      entry.removed = remove.map((m) => m.id);
    }
    // 2) Orden final.
    const moves = final.map((m, i) => ({ id: m.id, newPosition: String(i) }));
    const ro = await gql(`mutation($id:ID!,$m:[MoveInput!]!){ productReorderMedia(id:$id, moves:$m){ mediaUserErrors{ field message } } }`, { id: live.id, m: moves });
    if (ro.productReorderMedia.mediaUserErrors.length) throw new Error(`${h}: ${JSON.stringify(ro.productReorderMedia.mediaUserErrors)}`);
    // 3) Cada color apunta a la primera foto de su color en la galería final.
    const co = live.options.find((o) => /color/i.test(o.name));
    const first = new Map();
    for (const m of final) if (m.color && !first.has(m.color)) first.set(m.color, m.id);
    const vars = live.variants.nodes.flatMap((v) => {
      const c = v.selectedOptions.find((o) => o.name === co.name).value;
      const id = first.get(c);
      return id && v.media.nodes[0]?.id !== id ? [{ id: v.id, mediaId: id }] : [];
    });
    if (vars.length) {
      const vr = await gql(`mutation($p:ID!,$v:[ProductVariantsBulkInput!]!){ productVariantsBulkUpdate(productId:$p, variants:$v){ userErrors{ field message } } }`, { p: live.id, v: vars });
      if (vr.productVariantsBulkUpdate.userErrors.length) throw new Error(`${h}: ${JSON.stringify(vr.productVariantsBulkUpdate.userErrors)}`);
      entry.variants = vars;
    }
    log.push(entry);
    console.log(`  ✓ aplicado (${entry.removed.length} desvinculadas, ${vars.length} variantes re-enlazadas)`);
  }
  console.log(`\nTotal: ${Object.keys(cur).length} productos, ${nHero} portadas cambian, ${nRemove} fotos se quitan.`);
  if (apply) {
    const f = path.join(__dirname, '.out', `curation-log-${Date.now()}.json`);
    fs.writeFileSync(f, JSON.stringify(log, null, 2));
    console.log(f);
  } else {
    for (let i = 0; i < rows.length; i += 10) console.log(contactSheet(rows.slice(i, i + 10), path.join(OUT, `plan-${i / 10 + 1}.jpg`)));
  }
}

// La ficha abre en la primera variante y muestra su foto: el color ganador debe ser el primer valor de la opción Color
// (el resto, por ventas). Solo cambia el orden: los ids de variantes, SKU y componentes de packs no cambian.
async function reorderOptions(apply) {
  const cur = loadCuration();
  let n = 0;
  for (const [h, p] of Object.entries(cur)) {
    const live = (await gql(`query($h:String!){ productByHandle(handle:$h){ id productType options{ name values } } }`, { h })).productByHandle;
    if (/pack/i.test(live.productType)) continue;
    const co = live.options.find((o) => /color/i.test(o.name));
    const winner = p.winner || p.winner_auto;
    if (!co || co.values[0] === winner) continue;
    const want = [...new Set([winner, ...Object.entries(p.units90).sort((a, b) => b[1] - a[1]).map(([c]) => c), ...co.values])].filter((c) => co.values.includes(c));
    n++;
    console.log(`${h}: ${co.values[0]} → ${want[0]}`);
    if (!apply) continue;
    const options = live.options.map((o) => ({ name: o.name, values: (o === co ? want : o.values).map((v) => ({ name: v })) }));
    const r = await gql(`mutation($id:ID!,$o:[OptionReorderInput!]!){ productOptionsReorder(productId:$id, options:$o){ userErrors{ field message } } }`, { id: live.id, o: options });
    if (r.productOptionsReorder.userErrors.length) throw new Error(`${h}: ${JSON.stringify(r.productOptionsReorder.userErrors)}`);
  }
  console.log(`${n} productos con el color ganador que no era el primero${apply ? ' (reordenados)' : ' (dry-run)'}`);
}

(async () => {
  if (cmd === '--options') await reorderOptions(process.argv.includes('--apply'));
  else if (cmd === '--classify') await classify();
  else if (cmd === '--sheet') sheetUnresolved();
  else if (cmd === '--plan') await planOrApply(false);
  else if (cmd === '--apply') await planOrApply(true);
  else throw new Error('Comando: --classify | --sheet | --plan | --apply');
})().catch((e) => { console.error(e.message); process.exit(1); });
