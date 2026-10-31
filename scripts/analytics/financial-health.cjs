// Salud financiera: P&L devengado, caja, economía unitaria, inventario y recompra (solo lectura).
// Uso: node scripts/analytics/financial-health.cjs [desde=2026-06-01]
// Imprime tablas cortas; el detalle queda en scripts/analytics/.out/health.json.
// Supuestos del dueño (2026-10-30): el libro tiene todos los gastos; nómina = pago por prenda
// (periodo 10→10) + contenido 800k/mes; los socios no tienen sueldo (su pago es la utilidad).
const fs = require('fs');
const path = require('path');
const { readOnly } = require('./db.cjs');
const { COST_SQL, orderFees } = require('./cost.cjs');
const { get, ACCOUNT } = require('../meta-ads/metaApi.cjs');
const { paginate } = require('../shopify-cro/shopifyCro.cjs');

const SINCE = process.argv[2] || '2026-06-01';
const OUT = path.join(__dirname, '.out');
const NOW = new Date();
const k = (n) => (n == null || !isFinite(n) ? '-' : `${(n / 1000).toFixed(0)}k`);
const M = (n) => (n == null || !isFinite(n) ? '-' : `${(n / 1e6).toFixed(2)}M`);
const pct = (x) => (x == null || !isFinite(x) ? '-' : `${(x * 100).toFixed(1)}%`);
const month = (d) => new Date(d).toISOString().slice(0, 7);
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-10) || null;

// Categorías del libro → rubro del P&L.
const RUBRO = {
  'Pago a proveedor': 'compras',
  Marketing: 'pauta',
  Nómina: 'nomina',
  Servicios: 'servicios',
  Logística: 'flete',
  'Logística — Envío a cliente': 'flete',
  'Logística RMA': 'devoluciones',
  'Pérdida por Merma': 'devoluciones',
};

async function fromDb() {
  return readOnly(async (q) => {
    const cfg = Object.fromEntries((await q('SELECT id, value FROM global_configs')).map((r) => [r.id, +r.value]));
    const costs = await q(COST_SQL, [cfg.printing_cost_per_meter || 0, cfg.ironing_cost || 0]);
    const lines = await q(`
      SELECT o.id AS order_id, o.created_at, o.status, o.is_cod, o.source, o.shipping_cost, o.customer_phone,
             o.cod_received_at, COALESCE(o.shopify_payment_gateway, '') AS gw,
             oi.kind, oi.quantity, oi.unit_price, oi.product_id,
             COALESCE(par.name, v.name, oi.external_name) AS parent_name
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products v ON v.id = oi.product_id
      LEFT JOIN products par ON par.id = COALESCE(v.parent_id, v.id)
      ORDER BY o.created_at`);
    const ledger = await q(`SELECT occurred_at, transaction_type AS t, category, amount, reference_type, description
                            FROM financial_transactions ORDER BY occurred_at`);
    const runs = await q('SELECT period_from, period_to, units, rate_per_unit, total_amount FROM unit_payment_runs ORDER BY period_from');
    const stock = await q(`
      SELECT p.id, p.stock, p.active, COALESCE(par.name, p.name) AS parent_name,
        (SELECT MAX(o.created_at) FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id AND o.status <> 'cancelled') AS last_sale
      FROM products p LEFT JOIN products par ON par.id = p.parent_id WHERE NOT p.is_parent`);
    const rm = await q('SELECT name, stock, unit_price FROM raw_materials');
    return { cfg, costs, lines, ledger, runs, stock, rm };
  });
}

async function metaSpendByMonth(months) {
  const ranges = months.map((m) => {
    const [y, mo] = m.split('-').map(Number);
    const end = new Date(Date.UTC(y, mo, 0));
    return { since: `${m}-01`, until: (end > NOW ? NOW : end).toISOString().slice(0, 10) };
  });
  try {
    const rows = (await get(`${ACCOUNT}/insights`, { fields: 'spend', time_ranges: JSON.stringify(ranges), limit: '100' })).data || [];
    return Object.fromEntries(rows.map((r) => [r.date_start.slice(0, 7), +r.spend]));
  } catch (e) {
    console.log('Meta API no disponible:', e.message.slice(0, 120));
    return {};
  }
}

// Envío por mes desde Shopify. Contra entrega: el cliente paga los 19k a la transportadora y ella se
// los queda (ni ingreso ni costo). Prepago: el envío cobrado es ingreso y la empresa paga el flete.
// Envío gratis (≥ 250k): la empresa paga el flete; en contra entrega le devuelve 19k al cliente.
// BH solo registra el envío de prepagos confirmados, así que el ingreso de envío se toma de Shopify.
async function shopifyShippingByMonth() {
  try {
    const os = await paginate(
      `query($after:String){orders(first:100,after:$after,query:"created_at:>=${SINCE}"){pageInfo{hasNextPage endCursor}
        nodes{createdAt cancelledAt paymentGatewayNames subtotalPriceSet{shopMoney{amount}} totalShippingPriceSet{shopMoney{amount}}}}}`,
      (d) => d.orders,
    );
    const out = {};
    for (const o of os.filter((x) => !x.cancelledAt)) {
      const x = (out[month(o.createdAt)] ||= { orders: 0, ship: 0, prepaid: 0, free: 0, free_cod: 0 });
      const cod = o.paymentGatewayNames.some((g) => /cash|cod|contra/i.test(g));
      const sh = +o.totalShippingPriceSet.shopMoney.amount;
      x.orders++;
      if (!cod) { x.prepaid++; x.ship += sh; }
      if (sh === 0) { x.free++; if (cod) x.free_cod++; }
    }
    return out;
  } catch (e) {
    console.log('Shopify no disponible:', e.message.slice(0, 120));
    return {};
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const db = await fromDb();
  const shopShip = await shopifyShippingByMonth();
  const costById = new Map(db.costs.map((c) => [c.id, +c.unit_cost]));

  // ---- Pedidos ----
  const orders = new Map();
  for (const l of db.lines) {
    let o = orders.get(l.order_id);
    if (!o) {
      o = { id: l.order_id, created_at: new Date(l.created_at), status: l.status, is_cod: l.is_cod, source: l.source,
        gw: l.gw, phone: phoneKey(l.customer_phone), cod_received_at: l.cod_received_at, shipping_cost: +l.shipping_cost,
        gross: 0, product_rev: 0, fee_rev: 0, units: 0, cogs: 0, unknown_units: 0, items: [] };
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
    o.items.push({ name: l.parent_name, rev: amt, units: l.quantity });
  }
  const valid = [...orders.values()].filter((o) => o.status !== 'cancelled' && o.created_at >= new Date(SINCE));
  for (const o of valid) {
    o.fees = orderFees(o, db.cfg);
    o.contribution = o.product_rev - o.cogs - o.fees;
  }

  // ---- Meses ----
  const months = [];
  for (let d = new Date(`${SINCE}T00:00:00Z`); d <= NOW; d.setUTCMonth(d.getUTCMonth() + 1)) months.push(month(d));
  const meta = await metaSpendByMonth(months);
  const blank = () => ({ orders: 0, units: 0, product_rev: 0, fee_rev: 0, cogs: 0, fees: 0, contribution: 0, cod: 0,
    ship_orders: 0, ledger: { income: 0, expense: 0, byRubro: {}, byCat: {} }, meta: 0 });
  const P = Object.fromEntries(months.map((m) => [m, blank()]));
  for (const o of valid) {
    const p = P[month(o.created_at)];
    if (!p) continue;
    p.orders++; p.units += o.units; p.product_rev += o.product_rev; p.fee_rev += o.fee_rev;
    if (o.source !== 'shopify') p.fee_rev_manual = (p.fee_rev_manual || 0) + o.fee_rev;
    p.cogs += o.cogs; p.fees += o.fees; p.contribution += o.contribution; p.cod += o.is_cod ? 1 : 0;
    p.ship_orders += o.shipping_cost;
  }
  for (const t of db.ledger) {
    const p = P[month(t.occurred_at)];
    if (!p) continue;
    const a = +t.amount;
    if (t.t === 'income') { p.ledger.income += a; p.ledger.byCat[t.category] = (p.ledger.byCat[t.category] || 0) + a; continue; }
    p.ledger.expense += a;
    const r = RUBRO[t.category] || 'otros';
    p.ledger.byRubro[r] = (p.ledger.byRubro[r] || 0) + a;
  }
  for (const m of months) P[m].meta = meta[m] || 0;

  // Pauta: factor libro/Meta (IVA y cargos) medido en meses con ambos datos; el P&L usa Meta API × factor.
  const both = months.filter((m) => P[m].meta && P[m].ledger.byRubro.pauta);
  const metaFactor = both.length ? sum(both, (m) => P[m].ledger.byRubro.pauta) / sum(both, (m) => P[m].meta) : 1;

  // Nómina devengada: tarifa por prenda × prendas del mes + sueldo de contenido fijo desde su primer
  // periodo + otros manuales en su mes. «Ganancias prima» (ago) se trata como pago por prenda anterior
  // al sistema (cubre las prendas jun–ago), así que no se suma aparte.
  const rate = db.runs.length ? +db.runs.at(-1).rate_per_unit : 10000;
  const CONTENT = 800000;
  const contentPays = db.ledger.filter((t) => t.category === 'Nómina' && /contenido/i.test(t.description || ''));
  const contentFrom = contentPays.length ? month(new Date(contentPays[0].occurred_at).setUTCMonth(new Date(contentPays[0].occurred_at).getUTCMonth() - 1)) : null;
  const manualPayroll = {};
  for (const t of db.ledger) {
    if (t.category !== 'Nómina' || t.reference_type === 'unit_payment' || /contenido|ganancias/i.test(t.description || '')) continue;
    manualPayroll[month(t.occurred_at)] = (manualPayroll[month(t.occurred_at)] || 0) + +t.amount;
  }
  for (const m of months) if (contentFrom && m >= contentFrom) manualPayroll[m] = (manualPayroll[m] || 0) + CONTENT;

  const pl = months.map((m) => {
    const p = P[m];
    // Envío: cobrado en prepagos de Shopify + líneas de envío de pedidos manuales; sin Shopify, lo de BH.
    const shipRev = shopShip[m] && shopShip[m].orders >= p.orders / 2 ? shopShip[m].ship + (p.fee_rev_manual || 0) : p.fee_rev;
    p.fee_rev = shipRev;
    const revenue = p.product_rev + p.fee_rev;
    const pauta = p.meta ? p.meta * metaFactor : p.ledger.byRubro.pauta || 0;
    const nomina = p.units * rate + (manualPayroll[m] || 0);
    const flete = p.ledger.byRubro.flete || 0;
    const servicios = p.ledger.byRubro.servicios || 0;
    const devol = p.ledger.byRubro.devoluciones || 0;
    const otros = p.ledger.byRubro.otros || 0;
    const gross = revenue - p.cogs - p.fees - flete; // margen tras costo de venta, comisiones y flete
    const utilidad = gross - pauta - nomina - servicios - devol - otros;
    const cashNet = p.ledger.income - p.ledger.expense;
    return { m, free: shopShip[m]?.free || 0, free_cod: shopShip[m]?.free_cod || 0,
      orders: p.orders, units: p.units, product_rev: p.product_rev, fee_rev: p.fee_rev, revenue, cogs: p.cogs,
      fees: p.fees, flete, ship_orders: p.ship_orders, gross, pauta, meta: p.meta, nomina, servicios, devol, otros, utilidad,
      cash_in: p.ledger.income, cash_out: p.ledger.expense, cash_net: cashNet, compras: p.ledger.byRubro.compras || 0,
      income_by_cat: p.ledger.byCat, cod: p.cod };
  });

  console.log(`P&L DEVENGADO (pedidos por created_at; pauta = Meta API × ${metaFactor.toFixed(3)}; nómina = ${k(rate)}/prenda + manuales)`);
  console.log('mes | ped | prendas | ingresos | COGS | comis | flete | margen bruto | pauta | nómina | servicios | devol+otros | UTILIDAD | margen');
  for (const r of pl) {
    console.log([r.m, r.orders, r.units, M(r.revenue), M(r.cogs), k(r.fees), k(r.flete), M(r.gross), k(r.pauta), k(r.nomina),
      k(r.servicios), k(r.devol + r.otros), M(r.utilidad), pct(r.utilidad / r.revenue)].join(' | '));
  }
  console.log('\nCAJA (libro por occurred_at)');
  console.log('mes | entradas | salidas | neto | compras proveedor | COGS devengado | Meta API | pauta libro');
  let cum = 0;
  for (const r of pl) {
    cum += r.cash_net;
    console.log([r.m, M(r.cash_in), M(r.cash_out), M(r.cash_net), M(r.compras), M(r.cogs), k(r.meta), k(P[r.m].ledger.byRubro.pauta)].join(' | '), `| acum ${M(cum)}`);
  }
  const allLedgerNet = sum(db.ledger, (t) => (t.t === 'income' ? 1 : -1) * +t.amount);
  console.log(`neto acumulado del libro desde el inicio: ${M(allLedgerNet)}`);

  // ---- Puente devengo ↔ caja ----
  const span = valid.filter((o) => o.created_at >= new Date('2026-08-01'));
  const salesSpan = sum(span, (o) => o.gross);
  const ledSpan = db.ledger.filter((t) => new Date(t.occurred_at) >= new Date('2026-08-01'));
  const incomeSpan = sum(ledSpan.filter((t) => t.t === 'income'), (t) => +t.amount);
  const comprasSpan = sum(ledSpan.filter((t) => t.category === 'Pago a proveedor'), (t) => +t.amount);
  const cogsSpan = sum(span, (o) => o.cogs);
  // COD a toda la historia: los estados de BH van rezagados (pedidos entregados siguen en «shipped»).
  const codAll = valid.filter((o) => o.is_cod);
  const codDelivered = sum(codAll, (o) => o.gross);
  const codPaid = sum(db.ledger.filter((t) => t.category === 'Pago COD'), (t) => +t.amount);
  const codOpen = codAll.filter((o) => !o.cod_received_at);
  const prepaid = sum(span.filter((o) => !o.is_cod), (o) => o.gross);
  const shopPaid = sum(ledSpan.filter((t) => t.category === 'Pago Shopify' || t.category === 'Ingreso manual'), (t) => +t.amount);
  console.log(`\nPUENTE desde ago: ventas brutas ${M(salesSpan)} vs entradas ${M(incomeSpan)} (dif ${M(salesSpan - incomeSpan)})`);
  console.log(`  COD (toda la historia): vendido ${M(codDelivered)} vs girado al libro ${M(codPaid)} (por cobrar ${M(codDelivered - codPaid)}) | sin marcar entregado ${codOpen.length} pedidos ${M(sum(codOpen, (o) => o.gross))}`);
  console.log(`  Flete: cobrado en líneas ${M(sum(span, (o) => o.fee_rev))} vs flete del libro ${M(sum(ledSpan.filter((t) => RUBRO[t.category] === 'flete'), (t) => +t.amount))} vs shipping_cost ${M(sum(span, (o) => o.shipping_cost))}`);
  console.log(`  Prepago: ventas ${M(prepaid)} vs pagos Shopify+manual ${M(shopPaid)} (dif ${M(prepaid - shopPaid)})`);
  console.log(`  Compras a proveedor ${M(comprasSpan)} vs COGS ${M(cogsSpan)} → inventario/anticipos ${M(comprasSpan - cogsSpan)}`);

  // ---- Economía unitaria (últimos 30 y 90 d) ----
  const win = (days) => {
    const since = Date.now() - days * 864e5;
    const os = valid.filter((o) => o.created_at.getTime() >= since);
    return { days, orders: os.length, units: sum(os, (o) => o.units), rev: sum(os, (o) => o.product_rev),
      cogs: sum(os, (o) => o.cogs), fees: sum(os, (o) => o.fees), contrib: sum(os, (o) => o.contribution),
      cod: os.filter((o) => o.is_cod).length, unknown: sum(os, (o) => o.unknown_units) };
  };
  const U = [win(30), win(90)];
  console.log('\nECONOMÍA UNITARIA');
  for (const u of U) {
    console.log(`${u.days} d: ${u.orders} ped | ticket prod ${k(u.rev / u.orders)} | prendas/ped ${(u.units / u.orders).toFixed(2)} | contrib/ped ${k(u.contrib / u.orders)} (${pct(u.contrib / u.rev)}) | COD ${pct(u.cod / u.orders)} | prendas sin costo ${u.unknown}`);
  }

  // ---- Recompra (por teléfono) ----
  const byCust = new Map();
  for (const o of valid) {
    if (!o.phone || /^0+$/.test(o.phone)) continue;
    const c = byCust.get(o.phone) || { orders: 0, rev: 0, contrib: 0, first: o.created_at };
    c.orders++; c.rev += o.product_rev; c.contrib += o.contribution;
    byCust.set(o.phone, c);
  }
  const custs = [...byCust.values()];
  const repeat = custs.filter((c) => c.orders > 1);
  const old = custs.filter((c) => Date.now() - c.first.getTime() > 60 * 864e5);
  const recomp = {
    customers: custs.length, repeat: repeat.length, repeat_rate: repeat.length / custs.length,
    repeat_orders_share: sum(repeat, (c) => c.orders) / sum(custs, (c) => c.orders),
    old_cohort: old.length, old_repeat_rate: old.filter((c) => c.orders > 1).length / (old.length || 1),
    contrib_per_customer: sum(custs, (c) => c.contrib) / custs.length,
  };
  console.log(`\nRECOMPRA: ${recomp.customers} clientes, ${recomp.repeat} repiten (${pct(recomp.repeat_rate)}); pedidos de recompra ${pct(recomp.repeat_orders_share)}; cohorte >60 d: ${recomp.old_cohort} con ${pct(recomp.old_repeat_rate)} recompra; contrib/cliente ${k(recomp.contrib_per_customer)}`);

  // ---- Inventario ----
  const salesUnits90 = new Map();
  for (const o of valid.filter((x) => Date.now() - x.created_at.getTime() <= 90 * 864e5)) {
    for (const it of o.items) salesUnits90.set(it.name, (salesUnits90.get(it.name) || 0) + it.units);
  }
  const inStock = db.stock.filter((s) => +s.stock > 0);
  const invValue = sum(inStock, (s) => +s.stock * (costById.get(s.id) || 0));
  const invUnits = sum(inStock, (s) => +s.stock);
  const dead = inStock.filter((s) => !s.last_sale || Date.now() - new Date(s.last_sale).getTime() > 60 * 864e5);
  const deadValue = sum(dead, (s) => +s.stock * (costById.get(s.id) || 0));
  const rmValue = sum(db.rm.filter((r) => +r.stock > 0), (r) => +r.stock * +r.unit_price);
  const cogs30 = U[0].cogs;
  const deadByParent = {};
  for (const s of dead) {
    const x = (deadByParent[s.parent_name] ||= { units: 0, value: 0, active: s.active });
    x.units += +s.stock; x.value += +s.stock * (costById.get(s.id) || 0);
  }
  const topDead = Object.entries(deadByParent).sort((a, b) => b[1].value - a[1].value).slice(0, 10);
  console.log(`\nINVENTARIO: producto terminado ${invUnits} u = ${M(invValue)} a costo | insumos ${M(rmValue)} | días de inventario ${(invValue / (cogs30 / 30)).toFixed(0)} | sin venta 60 d: ${sum(dead, (s) => +s.stock)} u = ${M(deadValue)}`);
  for (const [n, x] of topDead) console.log(`  muerto: ${n} | ${x.units} u | ${k(x.value)}${x.active ? '' : ' (archivado)'}`);

  // ---- Concentración (90 d) ----
  const byProd = {};
  for (const o of valid.filter((x) => Date.now() - x.created_at.getTime() <= 90 * 864e5)) {
    for (const it of o.items) byProd[it.name] = (byProd[it.name] || 0) + it.rev;
  }
  const prodRank = Object.entries(byProd).sort((a, b) => b[1] - a[1]);
  const totalProd = sum(prodRank, (x) => x[1]);
  console.log(`\nCONCENTRACIÓN 90 d: top1 ${prodRank[0][0]} ${pct(prodRank[0][1] / totalProd)} | top5 ${pct(sum(prodRank.slice(0, 5), (x) => x[1]) / totalProd)} | productos con venta ${prodRank.length}`);

  // ---- Semanas recientes (ritmo de octubre) ----
  const weeks = {};
  for (const o of valid.filter((x) => Date.now() - x.created_at.getTime() <= 63 * 864e5)) {
    const d = new Date(o.created_at); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const w = (weeks[d.toISOString().slice(0, 10)] ||= { orders: 0, rev: 0, contrib: 0 });
    w.orders++; w.rev += o.product_rev; w.contrib += o.contribution;
  }
  console.log('\nSEMANAS: ' + Object.entries(weeks).sort().map(([w, x]) => `${w.slice(5)} ${x.orders}p ${k(x.contrib)}`).join(' · '));

  // ---- Escenarios de nómina y meta de 10 % neto (base: último mes del rango) ----
  // Utilidad(n) = n × (deja_por_pedido − pago_por_prenda × prendas) − fijos. Meta 10 %: utilidad ≥ 0,10 × ingresos.
  const b = pl.at(-1);
  const per = (x) => x / b.orders;
  const upo = b.units / b.orders;
  const ticket = per(b.revenue);
  const before = per(b.product_rev - b.cogs - b.fees + b.fee_rev - b.flete - b.pauta); // antes de nómina
  const otherFixed = b.servicios + (manualPayroll[b.m] || 0) - CONTENT; // servicios + diseño
  const MODELS = [
    { name: 'Actual: 10k/prenda', perUnit: rate, fixed: 0 },
    { name: 'Fijo 2,0 M sin prestaciones', perUnit: 0, fixed: 2.0e6 },
    { name: 'Fijo 2,0 M con prestaciones (~2,72 M)', perUnit: 0, fixed: 2.72e6 },
    { name: 'Mixto: 1,2 M fijo + 4k/prenda', perUnit: 4000, fixed: 1.2e6 },
  ];
  const CONTENTS = [{ name: 'contenido 800k', v: CONTENT }, { name: 'contenido con prestaciones (~1,09 M)', v: 1.09e6 }];
  const scen = [];
  console.log(`\nESCENARIOS (base ${b.m}: ticket ${k(ticket)}, ${upo.toFixed(2)} prendas/ped, deja ${k(before)} antes de nómina; otros fijos ${k(otherFixed)})`);
  console.log('modelo | contenido | equilibrio ped | ped para 10 % | utilidad con 86 / 120 / 150 ped | indiferencia vs actual (prendas)');
  for (const md of MODELS) for (const ct of CONTENTS) {
    const unitM = before - md.perUnit * upo;
    const F = md.fixed + ct.v + otherFixed;
    const util = (n) => n * unitM - F;
    const s = { model: md.name, content: ct.name, unitM, F, be: F / unitM, n10: F / (unitM - 0.1 * ticket),
      u86: util(b.orders), u120: util(120), u150: util(150), indiff: md.perUnit < rate ? md.fixed / (rate - md.perUnit) : null };
    scen.push(s);
    console.log([md.name, ct.name, s.be.toFixed(0), s.n10.toFixed(0), `${M(s.u86)} / ${M(s.u120)} / ${M(s.u150)}`, s.indiff ? s.indiff.toFixed(0) : '-'].join(' | '));
  }

  fs.writeFileSync(path.join(OUT, 'health.json'), JSON.stringify({ generated: NOW, metaFactor, rate, pl, unit: U, recomp, scen,
    base: { m: b.m, ticket, upo, before, otherFixed },
    inventory: { invUnits, invValue, rmValue, deadUnits: sum(dead, (s) => +s.stock), deadValue, topDead },
    concentration: prodRank.slice(0, 10).map(([n, v]) => ({ n, v, share: v / totalProd })), weeks,
    bridge: { salesSpan, incomeSpan, codDelivered, codPaid, codOpen: codOpen.length, prepaid, shopPaid, comprasSpan, cogsSpan },
    ledgerNetAll: allLedgerNet }, null, 2));
})();
