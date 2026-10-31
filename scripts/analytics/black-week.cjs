// Economía de los packs de Black Week y reabastecimiento de prendas base (solo lectura: BD prod + Shopify Admin).
// Uso: node scripts/analytics/black-week.cjs
// Lee docs/marketing/black-week-2026/config.json; el detalle queda en scripts/analytics/.out/black-week.json.
const fs = require('fs');
const path = require('path');
const { readOnly } = require('./db.cjs');
const { COST_SQL } = require('./cost.cjs');
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
    const prepaid = await q(`SELECT AVG(CASE WHEN is_cod THEN 0 ELSE 1 END) AS share FROM orders
      WHERE status <> 'cancelled' AND created_at >= now() - interval '60 days'`);
    return { g, costs, variants, blanks, used, prepaidShare: +prepaid[0].share };
  });
}

async function shopifyPrices(handles) {
  const out = {};
  for (const h of handles) {
    const d = await gql(`query($h:String!){productByHandle(handle:$h){title variants(first:50){nodes{price selectedOptions{name value}}}}}`, { h });
    out[h] = d.productByHandle
      ? { title: d.productByHandle.title, prices: d.productByHandle.variants.nodes.map((v) => ({ price: +v.price, opts: v.selectedOptions })) }
      : null;
  }
  return out;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const sameOpt = (a, b) => a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();
const splitBlank = (name) => { const p = name.split(' - '); return { base: p.slice(0, 2).join(' - '), size: p[p.length - 1] }; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const handles = [...new Set(cfg.packs.flatMap((p) => p.versiones.flatMap((v) => v.componentes.map((c) => c.handle))))];
  const [db, shop] = await Promise.all([fromDb(), shopifyPrices(handles)]);
  const fee = (gross) => (gross * db.g.shopify_fee_percent) / 100 + db.prepaidShare * ((gross * db.g.gateway_fee_percent) / 100 + db.g.gateway_fee_fixed);
  const flete = cfg.envio.flete_promedio;

  // ---- Economía por pack ----
  const packs = [];
  const warnings = [];
  for (const p of cfg.packs) {
    for (const v of p.versiones) {
      const comps = v.componentes.map((c) => {
        const ids = db.variants.filter((x) => x.parent.includes(c.producto) && x.base_name.startsWith(c.base)).map((x) => x.id);
        const cost = median(ids.map((id) => db.costs.get(id)).filter((x) => x != null));
        const sp = shop[c.handle];
        const colorPrices = sp?.prices.filter((x) => x.opts.some((o) => sameOpt(o.value, c.color))) || [];
        const price = median((colorPrices.length ? colorPrices : sp?.prices || []).map((x) => x.price));
        if (cost == null) warnings.push(`Sin costo en BH: ${c.producto} sobre ${c.base}`);
        if (price == null) warnings.push(`Sin precio en Shopify: ${c.handle}`);
        if (sp && !colorPrices.length) warnings.push(`Color «${c.color}» no encontrado en Shopify: ${c.handle}`);
        return { ...c, title: sp?.title, cost: cost || 0, price: price || 0 };
      });
      const regular = comps.reduce((s, c) => s + c.price, 0);
      const cogs = comps.reduce((s, c) => s + c.cost, 0);
      const fees = fee(p.precio);
      const contribution = p.precio - cogs - fees - flete;
      packs.push({
        pack: p.id, nombre: p.nombre, version: v.id, version_nombre: v.nombre, precio: p.precio, regular, cogs: Math.round(cogs),
        fees: Math.round(fees), flete, contribucion: Math.round(contribution), ahorro: regular - p.precio + flete,
        ahorro_pct: (regular - p.precio + flete) / (regular + flete), componentes: comps,
      });
    }
  }

  // ---- Stock de prendas base ----
  const usedBy = new Map(db.used.map((r) => [r.name, { u90: +r.u90 || 0, u30: +r.u30 || 0 }]));
  const baseStock = {};
  for (const b of db.blanks) {
    const { base, size } = splitBlank(b.name);
    if (!bases.some((x) => b.name.startsWith(x))) continue;
    const key = bases.find((x) => b.name.startsWith(x));
    const e = (baseStock[key] ||= { stock: 0, u90: 0, u30: 0, sizes: {} });
    const u = usedBy.get(b.name) || { u90: 0, u30: 0 };
    e.stock += +b.stock; e.u90 += u.u90; e.u30 += u.u30;
    e.sizes[size] = { stock: +b.stock, u90: u.u90 };
    void base;
  }
  for (const e of Object.values(baseStock)) e.cobertura_semanas = e.u30 ? e.stock / (e.u30 / 4.3) : null;

  // ---- Demanda de la semana y reabastecimiento ----
  const d = cfg.demanda;
  const packsWeek = d.pedidos_semana * d.participacion_packs;
  const demand = {};
  for (const p of cfg.packs) for (const v of p.versiones) for (const c of v.componentes) {
    demand[c.base] = (demand[c.base] || 0) + packsWeek * p.mezcla * v.participacion;
  }
  // Pedidos sin pack: mismas proporciones de consumo que los últimos 90 días.
  const looseUnits = d.pedidos_semana * (1 - d.participacion_packs) * d.prendas_por_pedido_sin_pack;
  const totalU90 = [...usedBy.values()].reduce((s, x) => s + x.u90, 0);
  const restock = [];
  for (const [base, e] of Object.entries(baseStock)) {
    const loose = totalU90 ? (looseUnits * e.u90) / totalU90 : 0;
    const safety = (e.u30 / 4.3) * d.semanas_de_seguridad;
    const need = (demand[base] || 0) + loose + safety;
    const sizeTotal = Object.values(e.sizes).reduce((s, x) => s + x.u90, 0);
    const bySize = {};
    for (const s of Object.keys(e.sizes).sort((a, b) => SIZES.indexOf(a) - SIZES.indexOf(b))) {
      const share = sizeTotal ? e.sizes[s].u90 / sizeTotal : 1 / Object.keys(e.sizes).length;
      // Las bases de los packs no pueden quedar sin una talla principal.
      const floor = demand[base] && MAIN_SIZES.includes(s) ? d.minimo_por_talla : 0;
      bySize[s] = Math.max(0, Math.ceil(Math.max(need * share, floor) - e.sizes[s].stock));
    }
    const buy = Object.values(bySize).reduce((s, x) => s + x, 0);
    restock.push({ base, stock: e.stock, u30: e.u30, cobertura_semanas: e.cobertura_semanas, demanda_semana: Math.round(need), comprar: buy, tallas: bySize });
  }

  // ---- Salida ----
  console.log('PACK | precio | regular | ahorro cliente (con flete) | COGS | comisiones | flete | CONTRIBUCIÓN');
  for (const x of packs) {
    console.log(`${x.version_nombre} | ${k(x.precio)} | ${k(x.regular)} | ${k(x.ahorro)} (${(x.ahorro_pct * 100).toFixed(0)}%) | ${k(x.cogs)} | ${k(x.fees)} | ${k(x.flete)} | ${k(x.contribucion)}`);
  }
  console.log('\nBASE | stock | vendidas 30 d | cobertura (sem) | demanda semana | comprar | por talla');
  for (const r of restock.sort((a, b) => b.comprar - a.comprar)) {
    console.log(`${r.base} | ${r.stock} | ${r.u30} | ${r.cobertura_semanas == null ? '∞' : r.cobertura_semanas.toFixed(1)} | ${r.demanda_semana} | ${r.comprar} | ${JSON.stringify(r.tallas)}`);
  }
  if (warnings.length) console.log('\nAVISOS:\n- ' + [...new Set(warnings)].join('\n- '));
  fs.writeFileSync(path.join(OUT, 'black-week.json'), JSON.stringify({
    generado: new Date().toISOString(), participacion_prepago: db.prepaidShare, packs, restock, avisos: [...new Set(warnings)],
  }, null, 2));
  console.log(`\nDetalle: ${path.join(OUT, 'black-week.json')}`);
})().catch((e) => { console.error(e); process.exit(1); });
