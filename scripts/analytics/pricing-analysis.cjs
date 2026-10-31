// Análisis de precios vs. rentabilidad (solo lectura: BD prod + Shopify Admin).
// Uso: node scripts/analytics/pricing-analysis.cjs [dias_producto=90]
// Imprime tablas cortas; el detalle queda en scripts/analytics/.out/pricing.json.
const fs = require('fs');
const path = require('path');
const { readOnly } = require('./db.cjs');
const { COST_SQL, orderFees } = require('./cost.cjs');
const { gql, paginate } = require('../shopify-cro/shopifyCro.cjs');

const DAYS = +(process.argv[2] || 90);
const OUT = path.join(__dirname, '.out');
const CUTS = [0.05, 0.1, 0.15];

const k = (n) => (n == null || !isFinite(n) ? '-' : `${(n / 1000).toFixed(1)}k`);
const pct = (x) => (x == null || !isFinite(x) ? '-' : `${(x * 100).toFixed(1)}%`);
const norm = (s) => String(s || '').toLowerCase().replace(/["“”']/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
const monday = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
};

const LINES_SQL = `
  SELECT o.id AS order_id, o.created_at, o.status, o.is_cod, o.source, o.shipping_cost,
         COALESCE(o.shopify_payment_gateway, '') AS gw, COALESCE(o.payment_method, '') AS pm,
         oi.kind, oi.quantity, oi.unit_price, oi.product_id, oi.external_name, v.sku,
         par.id AS parent_id, COALESCE(par.name, v.name, oi.external_name) AS parent_name
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products v ON v.id = oi.product_id
  LEFT JOIN products par ON par.id = COALESCE(v.parent_id, v.id)
  ORDER BY o.created_at`;

async function fromDb() {
  return readOnly(async (q) => {
    const cfg = Object.fromEntries((await q('SELECT id, value FROM global_configs')).map((r) => [r.id, +r.value]));
    const costs = await q(COST_SQL, [cfg.printing_cost_per_meter || 0, cfg.ironing_cost || 0]);
    const lines = await q(LINES_SQL);
    const returns = await q(`SELECT created_at, resolution_status, company_assumes_shipping, return_shipping_cost FROM returns`);
    return { cfg, costs, lines, returns };
  });
}

async function fromShopify() {
  const products = await paginate(
    `query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor}
      nodes{title handle status productType totalInventory
        variants(first:50){nodes{sku price compareAtPrice inventoryQuantity}}}}}`,
    (d) => d.products,
  );
  const orders = await paginate(
    `query($after:String){orders(first:100,after:$after,query:"created_at:>=${new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)}"){
      pageInfo{hasNextPage endCursor}
      nodes{name createdAt cancelledAt discountCodes totalDiscountsSet{shopMoney{amount}}}}}`,
    (d) => d.orders,
  );
  // Conversión de las sesiones que aterrizan en cada ficha de producto (lo que mueve la pauta).
  let views = [];
  const r = await gql(`query($q:String!){shopifyqlQuery(query:$q){parseErrors tableData{rows}}}`, {
    q: "FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_completed_checkout WHERE landing_page_path CONTAINS '/products/' GROUP BY landing_page_path SINCE -60d UNTIL today ORDER BY sessions DESC LIMIT 150",
  });
  if (r.shopifyqlQuery.parseErrors?.length) console.log('ShopifyQL:', JSON.stringify(r.shopifyqlQuery.parseErrors).slice(0, 200));
  views = (r.shopifyqlQuery.tableData?.rows || []).map((row) => {
    const v = Object.values(row);
    return { handle: String(v[0]).split('/products/')[1]?.split(/[?/]/)[0], views: +v[1] || 0, carts: +v[2] || 0, purchases: +v[3] || 0 };
  });
  return { products, orders, views };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const [db, shop] = await Promise.all([fromDb(), fromShopify()]);
  const costById = new Map(db.costs.map((c) => [c.id, +c.unit_cost]));

  // ---- Pedidos ----
  const orders = new Map();
  for (const l of db.lines) {
    let o = orders.get(l.order_id);
    if (!o) {
      o = { id: l.order_id, created_at: new Date(l.created_at), status: l.status, is_cod: l.is_cod, source: l.source,
        gw: l.gw, shipping_cost: +l.shipping_cost, gross: 0, product_rev: 0, fee_rev: 0, units: 0, cogs: 0,
        unknown_units: 0, lines: [] };
      orders.set(l.order_id, o);
    }
    const amt = l.quantity * +l.unit_price;
    o.gross += amt;
    if (l.kind === 'fee') { o.fee_rev += amt; continue; }
    o.product_rev += amt;
    o.units += l.quantity;
    const c = l.product_id ? costById.get(l.product_id) : null;
    if (c == null) o.unknown_units += l.quantity;
    o.cogs += (c || 0) * l.quantity;
    o.lines.push(l);
  }
  const valid = [...orders.values()].filter((o) => o.status !== 'cancelled');
  for (const o of valid) {
    o.fees = orderFees(o, db.cfg);
    o.contribution = o.product_rev - o.cogs - o.fees;
  }

  // ---- 1. Tendencia semanal ----
  const weeks = {};
  for (const o of valid) {
    const w = (weeks[monday(o.created_at)] ||= { orders: 0, units: 0, rev: 0, contrib: 0 });
    w.orders++; w.units += o.units; w.rev += o.product_rev; w.contrib += o.contribution;
  }
  console.log('SEMANA (lunes) | pedidos | prendas | venta prod | ticket prod | prendas/ped | contrib.');
  for (const [w, x] of Object.entries(weeks).sort()) {
    console.log(`${w} | ${x.orders} | ${x.units} | ${k(x.rev)} | ${k(x.rev / x.orders)} | ${(x.units / x.orders).toFixed(2)} | ${k(x.contrib)}`);
  }

  // ---- 2. Economía del periodo ----
  const since = Date.now() - DAYS * 864e5;
  const recent = valid.filter((o) => o.created_at.getTime() >= since);
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const R = {
    orders: recent.length, units: sum(recent, (o) => o.units), rev: sum(recent, (o) => o.product_rev),
    cogs: sum(recent, (o) => o.cogs), fees: sum(recent, (o) => o.fees), contrib: sum(recent, (o) => o.contribution),
    unknown: sum(recent, (o) => o.unknown_units), cod: recent.filter((o) => o.is_cod).length,
    feeRev: sum(recent, (o) => o.fee_rev), shipCost: sum(recent, (o) => o.shipping_cost),
  };
  const cancelled = [...orders.values()].filter((o) => o.status === 'cancelled' && o.created_at.getTime() >= since).length;
  console.log(`\nULTIMOS ${DAYS} d: pedidos ${R.orders} (+${cancelled} cancel.) | prendas ${R.units} (${R.unknown} sin costo) | COD ${pct(R.cod / R.orders)}`);
  console.log(`venta prod ${k(R.rev)} | COGS ${k(R.cogs)} | comisiones ${k(R.fees)} | contribución ${k(R.contrib)} (${pct(R.contrib / R.rev)})`);
  console.log(`por pedido: venta ${k(R.rev / R.orders)} | contrib ${k(R.contrib / R.orders)} | prendas ${(R.units / R.orders).toFixed(2)} | por prenda: precio ${k(R.rev / R.units)} costo ${k(R.cogs / R.units)} contrib ${k(R.contrib / R.units)}`);
  console.log(`flete: cobrado en líneas ${k(R.feeRev)} | shipping_cost ${k(R.shipCost)} | devoluciones totales ${db.returns.length}`);

  // ---- 3. Por producto padre ----
  const shopBySku = new Map(shop.products.flatMap((p) => p.variants.nodes.filter((v) => v.sku).map((v) => [v.sku, p])));
  const shopByTitle = new Map(shop.products.map((p) => [norm(p.title), p]));
  const viewsByHandle = {};
  for (const v of shop.views) {
    const x = (viewsByHandle[v.handle] ||= { views: 0, carts: 0, purchases: 0 });
    x.views += v.views; x.carts += v.carts; x.purchases += v.purchases;
  }
  const parents = {};
  for (const o of recent) {
    const share = o.product_rev ? o.fees / o.product_rev : 0;
    for (const l of o.lines) {
      const key = l.parent_id || `ext:${norm(l.parent_name)}`;
      const p = (parents[key] ||= { name: l.parent_name, skus: new Set(), units: 0, rev: 0, cogs: 0, fees: 0, prices: {} });
      if (l.sku) p.skus.add(l.sku);
      p.units += l.quantity; p.rev += l.quantity * +l.unit_price;
      p.cogs += l.quantity * (costById.get(l.product_id) || 0);
      p.fees += l.quantity * +l.unit_price * share;
      const pr = Math.round(+l.unit_price);
      p.prices[pr] = (p.prices[pr] || 0) + l.quantity;
    }
  }
  const rows = Object.values(parents).map((p) => {
    const sp = [...p.skus].map((s) => shopBySku.get(s)).find(Boolean) || shopByTitle.get(norm(p.name)) || null;
    const vprices = (sp?.variants.nodes || []).map((v) => +v.price).filter(Boolean);
    const cmp = (sp?.variants.nodes || []).map((v) => +v.compareAtPrice).filter(Boolean);
    const realized = p.rev / p.units;
    const unitCost = p.cogs / p.units;
    const feeRate = p.rev ? p.fees / p.rev : 0;
    const m = (realized * (1 - feeRate) - unitCost) / realized; // margen de contribución unitario
    const v = sp ? viewsByHandle[sp.handle] : null;
    return {
      name: (sp?.title || p.name || '').slice(0, 34), handle: sp?.handle || null, type: sp?.productType || '', units: p.units,
      list: vprices.length ? Math.max(...vprices) : null, compareAt: cmp.length ? Math.max(...cmp) : null,
      realized, unitCost, margin: m, contrib: p.rev - p.cogs - p.fees, prices: p.prices, inventory: sp?.totalInventory ?? null,
      sessions: v?.views ?? null, carts: v?.carts ?? null, purchases: v?.purchases ?? null,
      breakeven: CUTS.map((d) => d / (m - d)),
    };
  }).sort((a, b) => b.contrib - a.contrib);

  console.log(`\nPRODUCTO (${DAYS} d) | tipo | u | lista | compare | realizado | costo u | margen | contrib | +vol p/ -5/-10/-15% | landing ses→compra`);
  for (const r of rows.slice(0, 30)) {
    console.log([r.name.padEnd(34), r.type.slice(0, 12), r.units, k(r.list), k(r.compareAt), k(r.realized), k(r.unitCost), pct(r.margin), k(r.contrib),
      r.breakeven.map((x) => (x > 0 ? pct(x) : 'n/a')).join('/'), r.sessions ? `${r.sessions}→${pct(r.purchases / r.sessions)}` : '-'].join(' | '));
  }
  console.log(`sin cruce con Shopify: ${rows.filter((r) => !r.handle).length} de ${rows.length}`);

  // ---- 4. Experimentos naturales: productos vendidos a más de un precio ----
  console.log('\nPRECIOS DISTINTOS (precio: unidades) — top por unidades');
  for (const r of rows.filter((x) => Object.keys(x.prices).length > 1).slice(0, 12)) {
    console.log(`${r.name.padEnd(34)} ${Object.entries(r.prices).sort((a, b) => b[1] - a[1]).map(([p, u]) => `${k(+p)}:${u}`).join('  ')}`);
  }

  // ---- 5. Descuentos en Shopify (60 d) ----
  const live = shop.orders.filter((o) => !o.cancelledAt);
  const disc = live.filter((o) => +o.totalDiscountsSet.shopMoney.amount > 0);
  const codes = {};
  for (const o of disc) for (const c of o.discountCodes.length ? o.discountCodes : ['(automático)']) codes[c] = (codes[c] || 0) + 1;
  console.log(`\nSHOPIFY 60 d: pedidos ${live.length} | con descuento ${disc.length} (${pct(disc.length / live.length)}) | descuento total ${k(sum(disc, (o) => +o.totalDiscountsSet.shopMoney.amount))}`);
  console.log('códigos:', Object.entries(codes).map(([c, n]) => `${c}:${n}`).join(', ') || '-');

  // ---- 6. Conversión por banda de precio (landing de producto, 60 d) ----
  const priceByHandle = new Map(shop.products.map((p) => [p.handle, Math.max(...p.variants.nodes.map((v) => +v.price))]));
  const bands = {};
  for (const [handle, v] of Object.entries(viewsByHandle)) {
    const price = priceByHandle.get(handle);
    if (!price) continue;
    const b = price < 60000 ? '<60k' : price < 70000 ? '60-70k' : price < 80000 ? '70-80k' : '80k+';
    const x = (bands[b] ||= { n: 0, views: 0, carts: 0, purchases: 0 });
    x.n++; x.views += v.views; x.carts += v.carts; x.purchases += v.purchases;
  }
  console.log('\nBANDA PRECIO (landing de producto, 60 d) | productos | sesiones | →carrito | →compra');
  for (const [b, x] of Object.entries(bands).sort()) console.log(`${b} | ${x.n} | ${x.views} | ${pct(x.carts / x.views)} | ${pct(x.purchases / x.views)}`);

  // ---- 7. Catálogo actual por tipo ----
  const types = {};
  for (const p of shop.products.filter((x) => x.status === 'ACTIVE')) {
    const price = Math.max(...p.variants.nodes.map((v) => +v.price));
    (types[p.productType || '(sin tipo)'] ||= []).push(price);
  }
  console.log('\nCATALOGO ACTIVO por tipo | n | min | mediana | max');
  for (const [t, ps] of Object.entries(types).sort((a, b) => b[1].length - a[1].length)) {
    ps.sort((a, b) => a - b);
    console.log(`${t} | ${ps.length} | ${k(ps[0])} | ${k(ps[Math.floor(ps.length / 2)])} | ${k(ps[ps.length - 1])}`);
  }

  fs.writeFileSync(path.join(OUT, 'pricing.json'), JSON.stringify({ generated: new Date().toISOString(), days: DAYS, summary: R, weeks, products: rows, bands, types, discounts: { codes, n: disc.length, of: live.length } }, null, 2));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
