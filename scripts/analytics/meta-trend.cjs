// Tendencia de pauta vs. pedidos reales y estado de los anuncios (solo lectura).
// Uso: node scripts/analytics/meta-trend.cjs [desde_corte=2026-10-15]
// Semanas: gasto Meta, compras pixel, pedidos BD, pedidos Meta por último clic (Shopify UTM).
const fs = require('fs');
const path = require('path');
const { get, all, act, ACCOUNT } = require('../meta-ads/metaApi.cjs');
const { paginate } = require('../shopify-cro/shopifyCro.cjs');
const { readOnly } = require('./db.cjs');

const SPLIT = process.argv[2] || '2026-10-15';
const PUR = 'offsite_conversion.fb_pixel_purchase';
const OUT = path.join(__dirname, '.out');
const day = (d) => new Date(d).toISOString().slice(0, 10);
const today = day(Date.now());
const k = (n) => (n == null || !isFinite(n) ? '-' : `${(n / 1000).toFixed(1)}k`);
const monday = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return day(x);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const since = monday(Date.now() - 120 * 864e5);
  // Con time_increment la cuenta devuelve spend=0; se piden rangos semanales en una sola llamada.
  const ranges = [];
  for (let t = new Date(since).getTime(); t <= Date.now(); t += 7 * 864e5) {
    ranges.push({ since: day(t), until: day(Math.min(t + 6 * 864e5, Date.now())) });
  }
  const daily = (await get(`${ACCOUNT}/insights`, {
    fields: 'spend,actions,action_values', time_ranges: JSON.stringify(ranges), limit: '100',
  })).data || [];

  const dbOrders = await readOnly((q) => q(
    `SELECT created_at, (SELECT SUM(quantity * unit_price) FROM order_items oi WHERE oi.order_id = o.id AND oi.kind <> 'fee') AS rev
     FROM orders o WHERE status <> 'cancelled' AND created_at >= $1`, [since]));

  const shopOrders = await paginate(
    `query($after:String){orders(first:100,after:$after,query:"created_at:>=${day(Date.now() - 59 * 864e5)}"){pageInfo{hasNextPage endCursor}
      nodes{createdAt cancelledAt customerJourneySummary{lastVisit{source utmParameters{medium content}}}}}}`,
    (d) => d.orders,
  );

  const W = {};
  const w = (d) => (W[monday(d)] ||= { spend: 0, pur: 0, pv: 0, lpv: 0, orders: 0, rev: 0, metaLast: 0, shopOrders: 0 });
  for (const d of daily) {
    const x = w(d.date_start);
    x.spend += +d.spend; x.pur += act(d.actions, PUR); x.pv += act(d.action_values, PUR); x.lpv += act(d.actions, 'landing_page_view');
  }
  for (const o of dbOrders) { const x = w(o.created_at); x.orders++; x.rev += +o.rev || 0; }
  for (const o of shopOrders.filter((x) => !x.cancelledAt)) {
    const x = w(o.createdAt);
    x.shopOrders++;
    const lv = o.customerJourneySummary?.lastVisit;
    if (/paid/.test(lv?.utmParameters?.medium || '') || /facebook|instagram/i.test(lv?.source || '')) x.metaLast++;
  }
  console.log('SEMANA | gasto | LPV | compras px | CPA px | pedidos BD | pedidos Shopify | Meta últ.clic* | CPA real | ROAS BD');
  for (const [s, x] of Object.entries(W).sort()) {
    console.log([s, k(x.spend), x.lpv, x.pur, x.pur ? k(x.spend / x.pur) : '-', x.orders, x.shopOrders || '-', x.metaLast || '-',
      x.metaLast ? k(x.spend / x.metaLast) : '-', x.spend ? (x.rev / x.spend).toFixed(1) : '-'].join(' | '));
  }
  console.log('* último clic con utm medium=paid o fuente facebook/instagram (Shopify retiene 60 d)');

  // Anuncios: estado y resultados desde el corte.
  const ads = await all(`${ACCOUNT}/ads`, { fields: 'name,effective_status,configured_status,ad_review_feedback', limit: '100' });
  const ins = (await get(`${ACCOUNT}/insights`, {
    level: 'ad', fields: 'ad_name,spend,frequency,inline_link_click_ctr,actions', limit: '200',
    time_range: JSON.stringify({ since: SPLIT, until: today }),
  })).data || [];
  const byName = new Map(ins.map((x) => [x.ad_name, x]));
  console.log(`\nANUNCIOS (desde ${SPLIT}) | estado | gasto | freq | CTR | LPV | ATC | compras px | CPA px | revisión`);
  for (const a of ads.filter((x) => x.effective_status !== 'ARCHIVED' && x.effective_status !== 'DELETED')) {
    const x = byName.get(a.name);
    if (!x && a.effective_status !== 'ACTIVE' && !a.ad_review_feedback) continue;
    const s = +(x?.spend || 0); const pur = act(x?.actions, PUR);
    console.log([a.name.slice(0, 34).padEnd(34), a.effective_status, k(s), x ? (+x.frequency).toFixed(2) : '-', x ? (+x.inline_link_click_ctr || 0).toFixed(2) : '-',
      act(x?.actions, 'landing_page_view'), act(x?.actions, 'offsite_conversion.fb_pixel_add_to_cart'), pur, pur ? k(s / pur) : '-',
      a.ad_review_feedback ? JSON.stringify(a.ad_review_feedback).slice(0, 80) : ''].join(' | '));
  }
  fs.writeFileSync(path.join(OUT, 'meta-trend.json'), JSON.stringify({ generated: new Date().toISOString(), weeks: W, ads, ins }, null, 2));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
