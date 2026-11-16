// Economía de los packs de Black Week, envío gratis sí/no, P&L de la semana y reabastecimiento
// (solo lectura: BD prod + Shopify Admin + Meta).
// Uso: node scripts/analytics/black-week.cjs
// Lee docs/marketing/black-week-2026/config.json; el detalle queda en scripts/analytics/.out/black-week.json.
const fs = require('fs');
const path = require('path');
const { readOnly } = require('./db.cjs');
const { COST_SQL, orderFees } = require('./cost.cjs');
const { gql } = require('../shopify-cro/shopifyCro.cjs');

const CONFIG = path.join(__dirname, '../../docs/marketing/black-week-2026/config.json');
const OUT = path.join(__dirname, '.out');
const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const k = (n) => `${(n / 1000).toFixed(1)}k`;
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const MAIN_SIZES = ['S', 'M', 'L', 'XL'];

// Bases que tocan los packs y los complementos, más las estancadas de referencia.
const bases = [...new Set([
  ...cfg.packs.flatMap((p) => p.versiones.flatMap((v) => v.componentes.map((c) => c.base))),
  ...cfg.complementos.map((c) => c.base),
  'Camiseta Oversized 200 gr - 989-Nude', 'Camiseta Oversized 200 gr - Gris', 'Camiseta C4 200 gr - 001-Blanco', 'Camiseta C4 200 gr - 011-Negro',
  'Tank Oversized acid - Acid_negro',
])];

async function fromDb() {
  return readOnly(async (q) => {
    const g = Object.fromEntries((await q('SELECT id, value FROM global_configs')).map((r) => [r.id, +r.value]));
    const costs = new Map((await q(COST_SQL, [g.printing_cost_per_meter || 0, g.ironing_cost || 0])).map((r) => [r.id, +r.unit_cost]));
    const variants = await q(`
      SELECT v.id, par.name AS parent, rm.name AS base_name
      FROM products v JOIN products par ON par.id = v.parent_id
      JOIN product_materials pm ON pm.product_id = v.id AND pm.role = 'base'
      JOIN raw_materials rm ON rm.id = pm.raw_material_id
      WHERE v.active AND par.active`);
    const blanks = await q(`SELECT name, stock FROM raw_materials WHERE unit_of_measure = 'unit'`);
    // Consumo de cada blank por ventas (90 d y 30 d) a través del BOM base.
    const used = await q(`
      SELECT rm.name, SUM(oi.quantity * pm.quantity_required) AS u90,
             SUM(oi.quantity * pm.quantity_required) FILTER (WHERE o.created_at >= now() - interval '30 days') AS u30
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      JOIN product_materials pm ON pm.product_id = oi.product_id AND pm.role = 'base'
      JOIN raw_materials rm ON rm.id = pm.raw_material_id
      WHERE o.status <> 'cancelled' AND o.created_at >= now() - interval '90 days'
      GROUP BY 1`);
    // Líneas de 90 d para la línea base (agrupar por created_at: delivered_at está distorsionado).
    const lines = await q(`
      SELECT o.id, o.source, o.is_cod, COALESCE(o.shopify_payment_gateway, '') AS gw, oi.kind, oi.quantity, oi.unit_price, oi.product_id
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status <> 'cancelled' AND o.created_at >= now() - interval '90 days'`);
    const rate = await q('SELECT rate_per_unit FROM unit_payment_runs ORDER BY period_to DESC LIMIT 1');
    return { g, costs, variants, blanks, used, lines, nomina: rate.length ? +rate[0].rate_per_unit : cfg.nomina_por_prenda };
  });
}

async function shopifyProducts(handles) {
  const out = {};
  for (const h of handles) {
    const d = await gql(`query($h:String!){productByHandle(handle:$h){title featuredImage{url}
      variants(first:50){nodes{price compareAtPrice selectedOptions{name value}}}}}`, { h });
    const p = d.productByHandle;
    out[h] = p ? {
      title: p.title, image: p.featuredImage?.url || null,
      variants: p.variants.nodes.map((v) => ({ price: +v.price, list: Math.max(+v.compareAtPrice || 0, +v.price), opts: v.selectedOptions })),
    } : null;
  }
  return out;
}

// Miniaturas y métricas de los anuncios de referencia (la API de Meta solo se lee).
async function metaAds() {
  const trendPath = path.join(OUT, 'meta-trend.json');
  const trend = fs.existsSync(trendPath) ? JSON.parse(fs.readFileSync(trendPath, 'utf8')) : { ins: [] };
  const act = (x, t) => +((x.actions || []).find((a) => a.action_type === t) || {}).value || 0;
  let meta = null;
  try { meta = require('../meta-ads/metaApi.cjs'); } catch { /* sin credenciales: solo métricas */ }
  const out = [];
  for (const a of cfg.aprendizajes_cuenta.anuncios) {
    const ins = trend.ins.find((x) => x.ad_name === a.nombre);
    let thumb = null;
    if (meta) {
      try {
        const r = await meta.get(a.ad_id, { fields: 'creative{thumbnail_url,image_url,object_story_spec}' });
        const c = r.creative || {};
        const oss = c.object_story_spec || {};
        // thumbnail_url es de 64 px: se prefiere la imagen completa (estático, portada del video o 1.ª tarjeta del carrusel).
        thumb = c.image_url || oss.video_data?.image_url || null;
        const hash = oss.link_data?.child_attachments?.[0]?.image_hash;
        if (!thumb && hash) {
          const imgs = await meta.get(`${meta.ACCOUNT}/adimages`, { hashes: JSON.stringify([hash]), fields: 'url' });
          thumb = imgs.data?.[0]?.url || null;
        }
        thumb ||= c.thumbnail_url || null;
      } catch { /* la miniatura es opcional */ }
    }
    const spend = ins ? +ins.spend : null;
    const pur = ins ? act(ins, 'purchase') : null;
    const lpv = ins ? act(ins, 'landing_page_view') : null;
    out.push({ ...a, thumb, spend, compras: pur, cpa: pur ? spend / pur : null, ctr: ins ? +ins.inline_link_click_ctr : null,
      compra_visita: lpv ? pur / lpv : null, desde: ins?.date_start, hasta: ins?.date_stop });
  }
  return out;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const sameOpt = (a, b) => a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();
const splitBlank = (name) => name.split(' - ').at(-1);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const handles = [...new Set(cfg.packs.flatMap((p) => p.versiones.flatMap((v) => v.componentes.map((c) => c.handle))))];
  const [db, shop, anuncios] = await Promise.all([fromDb(), shopifyProducts(handles), metaAds()]);
  const flete = cfg.envio.flete_promedio;
  const NOM = db.nomina;
  const warnings = [];

  // ---- Línea base: margen de un pedido normal (90 d) ----
  const orders = new Map();
  for (const l of db.lines) {
    const o = orders.get(l.id) || { source: l.source, gw: l.gw, is_cod: l.is_cod, gross: 0, rev: 0, cogs: 0, units: 0 };
    const amt = l.quantity * +l.unit_price;
    o.gross += amt;
    if (l.kind !== 'fee') { o.rev += amt; o.units += l.quantity; o.cogs += (db.costs.get(l.product_id) || 0) * l.quantity; }
    orders.set(l.id, o);
  }
  const all = [...orders.values()];
  for (const o of all) o.margin = o.rev - o.cogs - orderFees(o, db.g) - NOM * o.units;
  const prepaidShare = all.filter((o) => !o.is_cod).length / all.length;
  const fee = (gross) => (gross * db.g.shopify_fee_percent) / 100 + prepaidShare * ((gross * db.g.gateway_fee_percent) / 100 + db.g.gateway_fee_fixed);
  // Pedidos sin pack que ganan envío gratis al bajar el umbral (de umbral_actual a umbral_black_week).
  const newlyFree = all.filter((o) => o.rev >= cfg.envio.umbral_black_week && o.rev < cfg.envio.umbral_actual).length / all.length;
  const base = {
    pedidos_90d: all.length,
    pedidos_semana: all.length / (90 / 7),
    margen_pedido: all.reduce((s, o) => s + o.margin, 0) / all.length,
    prendas_pedido: all.reduce((s, o) => s + o.units, 0) / all.length,
    nuevos_envio_gratis: newlyFree,
  };

  // ---- Economía por pack ----
  const packs = [];
  for (const p of cfg.packs) {
    for (const v of p.versiones) {
      const comps = v.componentes.map((c) => {
        const ids = db.variants.filter((x) => x.parent.includes(c.producto) && x.base_name.startsWith(c.base)).map((x) => x.id);
        const cost = median(ids.map((id) => db.costs.get(id)).filter((x) => x != null));
        const sp = shop[c.handle];
        const byColor = sp?.variants.filter((x) => x.opts.some((o) => sameOpt(o.value, c.color))) || [];
        const vs = byColor.length ? byColor : sp?.variants || [];
        if (cost == null) warnings.push(`Sin costo en BH: ${c.producto} sobre ${c.base}`);
        if (!sp) warnings.push(`Sin producto en Shopify: ${c.handle}`);
        else if (!byColor.length) warnings.push(`Color «${c.color}» no encontrado en Shopify: ${c.handle}`);
        return { ...c, title: sp?.title, image: sp?.image, cost: cost || 0, price: median(vs.map((x) => x.price)) || 0, list: median(vs.map((x) => x.list)) || 0 };
      });
      const n = comps.length;
      const regular = comps.reduce((s, c) => s + c.price, 0);
      const lista = comps.reduce((s, c) => s + c.list, 0);
      const cogs = comps.reduce((s, c) => s + c.cost, 0);
      const before = p.precio - cogs - fee(p.precio) - NOM * n; // antes de flete
      packs.push({
        pack: p.id, nombre: p.nombre, version: v.id, version_nombre: v.nombre, participacion: v.participacion, mezcla: p.mezcla,
        prendas: n, precio: p.precio, envio_gratis: p.envio_gratis, regular, lista, cogs: Math.round(cogs),
        fees: Math.round(fee(p.precio)), nomina: NOM * n,
        descuento_lista: 1 - p.precio / lista, ahorro_lista: lista - p.precio + (p.envio_gratis ? flete : 0),
        margen: Math.round(before - (p.envio_gratis ? flete : 0)),
        margen_con_envio: Math.round(before - flete), margen_sin_envio: Math.round(before),
        componentes: comps,
      });
    }
  }

  // ---- P&L de la semana ----
  const d = cfg.demanda;
  const pauta = (diaria, dias) => diaria * dias * cfg.pauta.factor_impuestos;
  const packMargin = (key) => cfg.packs.reduce((s, p) => s + p.mezcla *
    packs.filter((x) => x.pack === p.id).reduce((t, x) => t + x.participacion * x[key], 0), 0);
  const looseMargin = base.margen_pedido - base.nuevos_envio_gratis * flete;
  const week = (perPack) => (N) => N * d.participacion_packs * perPack + N * (1 - d.participacion_packs) * looseMargin;
  const bwPauta = pauta(cfg.pauta.diaria_black_week, cfg.periodo.dias);
  const ladder = week(packMargin('margen'));
  const allFree = week(packMargin('margen_con_envio'));
  const escenarios = [
    { id: 'normal', nombre: 'Semana normal (sin campaña)', pedidos: base.pedidos_semana, margen: base.pedidos_semana * base.margen_pedido,
      pauta: pauta(cfg.pauta.diaria_actual, 7) },
    { id: 'todo_gratis', nombre: 'Packs con envío gratis', pedidos: d.pedidos_semana, margen: allFree(d.pedidos_semana), pauta: bwPauta },
    { id: 'escalera', nombre: `Escalera: envío gratis desde ${k(cfg.envio.umbral_black_week)}`, pedidos: d.pedidos_semana, margen: ladder(d.pedidos_semana), pauta: bwPauta },
  ].map((s) => ({ ...s, utilidad: s.margen - s.pauta }));
  const target = escenarios.find((s) => s.id === 'escalera').utilidad;
  const perOrderFree = allFree(1);
  const pedidosParaIgualar = (target + bwPauta) / perOrderFree;

  // ---- Stock de prendas base y reabastecimiento ----
  const usedBy = new Map(db.used.map((r) => [r.name, { u90: +r.u90 || 0, u30: +r.u30 || 0 }]));
  const baseStock = {};
  for (const b of db.blanks) {
    const key = bases.find((x) => b.name.startsWith(x));
    if (!key) continue;
    const e = (baseStock[key] ||= { stock: 0, u90: 0, u30: 0, sizes: {} });
    const u = usedBy.get(b.name) || { u90: 0, u30: 0 };
    e.stock += +b.stock; e.u90 += u.u90; e.u30 += u.u30;
    e.sizes[splitBlank(b.name)] = { stock: +b.stock, u90: u.u90 };
  }
  const packsWeek = d.pedidos_semana * d.participacion_packs;
  const demand = {};
  for (const p of cfg.packs) for (const v of p.versiones) for (const c of v.componentes) {
    demand[c.base] = (demand[c.base] || 0) + packsWeek * p.mezcla * v.participacion;
  }
  const looseUnits = d.pedidos_semana * (1 - d.participacion_packs) * d.prendas_por_pedido_sin_pack;
  const totalU90 = [...usedBy.values()].reduce((s, x) => s + x.u90, 0);
  const restock = [];
  for (const [b, e] of Object.entries(baseStock)) {
    const need = (demand[b] || 0) + (totalU90 ? (looseUnits * e.u90) / totalU90 : 0) + (e.u30 / 4.3) * d.semanas_de_seguridad;
    const sizeTotal = Object.values(e.sizes).reduce((s, x) => s + x.u90, 0);
    const bySize = {};
    for (const s of Object.keys(e.sizes).sort((a, z) => SIZES.indexOf(a) - SIZES.indexOf(z))) {
      const share = sizeTotal ? e.sizes[s].u90 / sizeTotal : 1 / Object.keys(e.sizes).length;
      // Las bases de los packs no pueden quedar sin una talla principal.
      const floor = demand[b] && MAIN_SIZES.includes(s) ? d.minimo_por_talla : 0;
      bySize[s] = Math.max(0, Math.ceil(Math.max(need * share, floor) - e.sizes[s].stock));
    }
    restock.push({ base: b, stock: e.stock, u30: e.u30, cobertura_semanas: e.u30 ? e.stock / (e.u30 / 4.3) : null,
      demanda_semana: Math.round(need), comprar: Object.values(bySize).reduce((s, x) => s + x, 0), tallas: bySize });
  }

  // ---- Salida ----
  console.log(`Nómina ${k(NOM)}/prenda · prepago ${(prepaidShare * 100).toFixed(0)} % · pedido normal: ${k(base.margen_pedido)} de margen, ${base.prendas_pedido.toFixed(2)} prendas, ${base.pedidos_semana.toFixed(1)}/semana`);
  console.log('\nPACK | precio | lista | desc. lista | envío gratis | MARGEN | con envío | sin envío');
  for (const x of packs) {
    console.log(`${x.version_nombre} | ${k(x.precio)} | ${k(x.lista)} | ${(x.descuento_lista * 100).toFixed(0)}% | ${x.envio_gratis ? 'sí' : 'no'} | ${k(x.margen)} | ${k(x.margen_con_envio)} | ${k(x.margen_sin_envio)}`);
  }
  console.log('\nESCENARIO | pedidos | margen | pauta | UTILIDAD');
  for (const s of escenarios) console.log(`${s.nombre} | ${s.pedidos.toFixed(0)} | ${k(s.margen)} | ${k(s.pauta)} | ${k(s.utilidad)}`);
  console.log(`Con envío gratis en todos los packs se necesitarían ${pedidosParaIgualar.toFixed(0)} pedidos para igualar la escalera (${d.pedidos_semana}).`);
  console.log('\nBASE | stock | 30 d | cobertura | comprar | por talla');
  for (const r of restock.filter((r) => r.comprar).sort((a, b) => b.comprar - a.comprar)) {
    console.log(`${r.base} | ${r.stock} | ${r.u30} | ${r.cobertura_semanas == null ? '∞' : r.cobertura_semanas.toFixed(1)} | ${r.comprar} | ${JSON.stringify(r.tallas)}`);
  }
  console.log('\nANUNCIOS | gasto | compras | CPA | compra/visita | miniatura');
  for (const a of anuncios) console.log(`${a.clave} | ${a.spend ? k(a.spend) : '-'} | ${a.compras ?? '-'} | ${a.cpa ? k(a.cpa) : '-'} | ${a.compra_visita != null ? (a.compra_visita * 100).toFixed(1) + '%' : '-'} | ${a.thumb ? 'sí' : 'no'}`);
  if (warnings.length) console.log('\nAVISOS:\n- ' + [...new Set(warnings)].join('\n- '));
  fs.writeFileSync(path.join(OUT, 'black-week.json'), JSON.stringify({
    generado: new Date().toISOString(), participacion_prepago: prepaidShare, nomina: NOM, base, packs, escenarios,
    pedidos_para_igualar: pedidosParaIgualar, restock, anuncios, avisos: [...new Set(warnings)],
  }, null, 2));
  console.log(`\nDetalle: ${path.join(OUT, 'black-week.json')}`);
})().catch((e) => { console.error(e); process.exit(1); });
