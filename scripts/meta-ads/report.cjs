// Reporte compacto para decidir sobre anuncios (Meta + embudo de Shopify + pedidos por UTM).
// Uso: node scripts/meta-ads/report.cjs [preset=last_7d] [desde_embudo=2026-10-12]
// Solo lectura. Imprime tablas cortas; no vuelca respuestas crudas.
const { get, act, ACCOUNT } = require('./metaApi.cjs');
const { gql, paginate } = require('../shopify-cro/shopifyCro.cjs');

const PRESET = process.argv[2] || 'last_7d';
const SPLIT = process.argv[3] || '2026-10-12';
const PUR = 'offsite_conversion.fb_pixel_purchase';
const F = 'ad_name,adset_name,spend,impressions,frequency,cpm,inline_link_clicks,inline_link_click_ctr,actions,action_values,video_thruplay_watched_actions';

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '-');
const k = (n) => (n == null ? '-' : `${(n / 1000).toFixed(1)}k`);

function adRow(x) {
  const s = +x.spend;
  const lpv = act(x.actions, 'landing_page_view');
  const atc = act(x.actions, 'offsite_conversion.fb_pixel_add_to_cart');
  const ic = act(x.actions, 'offsite_conversion.fb_pixel_initiate_checkout');
  const pur = act(x.actions, PUR);
  const v3 = act(x.actions, 'video_view');
  const thru = act(x.video_thruplay_watched_actions, 'video_view');
  return [
    x.ad_name.slice(0, 34).padEnd(34), k(s), (+x.frequency).toFixed(2), (+x.inline_link_click_ctr || 0).toFixed(2),
    pct(atc, lpv), pct(ic, atc), pct(pur, lpv), pur, pur ? k(s / pur) : '-',
    v3 ? pct(v3, +x.impressions) : '-', v3 ? pct(thru, v3) : '-',
  ].join(' | ');
}

async function meta() {
  const acc = (await get(`${ACCOUNT}/insights`, { fields: F, date_preset: PRESET })).data?.[0];
  if (acc) {
    const pur = act(acc.actions, PUR);
    console.log(`META ${PRESET}: gasto ${k(+acc.spend)} | compras pixel ${pur} | CPA ${pur ? k(acc.spend / pur) : '-'} | freq ${(+acc.frequency).toFixed(2)} | CTR ${(+acc.inline_link_click_ctr).toFixed(2)}`);
  }
  const ads = (await get(`${ACCOUNT}/insights`, { fields: F, level: 'ad', date_preset: PRESET, limit: '200' })).data || [];
  console.log('\nanuncio | gasto | freq | CTR | ATC/LPV% | IC/ATC% | PUR/LPV% | compras | CPA | hook% | hold%');
  for (const x of ads.filter((a) => +a.spend > 1000).sort((a, b) => b.spend - a.spend)) console.log(adRow(x));
}

async function shopify() {
  const q = `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout WHERE session_device_type = 'mobile' SINCE -28d UNTIL today TIMESERIES day`;
  const r = await gql('query($q:String!){shopifyqlQuery(query:$q){parseErrors tableData{rows}}}', { q });
  if (r.shopifyqlQuery.parseErrors?.length) return console.log('ShopifyQL:', JSON.stringify(r.shopifyqlQuery.parseErrors));
  const agg = { antes: [0, 0, 0, 0], despues: [0, 0, 0, 0] };
  for (const row of r.shopifyqlQuery.tableData.rows) {
    const v = Object.values(row);
    const bucket = String(v[0]) >= SPLIT ? 'despues' : 'antes';
    for (let i = 0; i < 4; i++) agg[bucket][i] += +v[i + 1] || 0;
  }
  console.log(`\nSHOPIFY móvil 28 d (corte ${SPLIT}): sesiones | ATC% | carrito→checkout% | checkout→compra% | conversión%`);
  for (const [n, [s, a, c, p]] of Object.entries(agg)) console.log(`${n.padEnd(7)} ${s} | ${pct(a, s)} | ${pct(c, a)} | ${pct(p, c)} | ${pct(p, s)}`);

  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const orders = await paginate(
    `query($after:String){orders(first:100,after:$after,query:"created_at:>=${since}"){pageInfo{hasNextPage endCursor} nodes{cancelledAt customerJourneySummary{lastVisit{utmParameters{source medium content}}}}}}`,
    (d) => d.orders,
  );
  const live = orders.filter((o) => !o.cancelledAt);
  const byAd = {};
  for (const o of live) {
    const u = o.customerJourneySummary?.lastVisit?.utmParameters;
    if (u && /paid/.test(u.medium || '')) byAd[u.content || '(sin utm_content)'] = (byAd[u.content || '(sin utm_content)'] || 0) + 1;
  }
  const paid = Object.values(byAd).reduce((a, b) => a + b, 0);
  console.log(`\nPEDIDOS 7 d: ${live.length} | Meta pagado por último clic: ${paid}`);
  for (const [ad, n] of Object.entries(byAd).sort((a, b) => b[1] - a[1])) console.log(`  ${ad}: ${n}`);
}

(async () => {
  await meta();
  await shopify();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
