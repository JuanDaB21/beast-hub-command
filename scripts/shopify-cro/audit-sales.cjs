// Snapshot de pedidos (60 días), checkouts abandonados y ShopifyQL → .out/sales.json
// Uso: node scripts/shopify-cro/audit-sales.cjs
const fs = require('fs');
const path = require('path');
const { gql, paginate } = require('./shopifyCro.cjs');

const OUT = path.join(__dirname, '.out');

const ORDERS_Q = `query($after: String) { orders(first: 100, after: $after, sortKey: CREATED_AT, reverse: true) {
  nodes { name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
    paymentGatewayNames sourceName
    totalPriceSet { shopMoney { amount } }
    totalShippingPriceSet { shopMoney { amount } }
    currentSubtotalLineItemsQuantity
    shippingAddress { province city }
    customerJourneySummary { daysToConversion
      firstVisit { source sourceType landingPage utmParameters { source medium campaign } }
      lastVisit { source landingPage } }
    lineItems(first: 20) { nodes { title quantity variantTitle product { handle } } }
  }
  pageInfo { hasNextPage endCursor } } }`;

const ABANDONED_Q = `query($after: String) { abandonedCheckouts(first: 100, after: $after, reverse: true) {
  nodes { createdAt completedAt
    totalPriceSet { shopMoney { amount } }
    shippingAddress { province }
    lineItems(first: 20) { nodes { title quantity } } }
  pageInfo { hasNextPage endCursor } } }`;

// ShopifyQL: cada consulta se intenta por separado; un error de sintaxis no tumba el resto.
const QL = {
  sessions_by_device: 'FROM sessions SHOW sessions, conversion_rate GROUP BY session_device_type SINCE -60d UNTIL today',
  funnel_by_day: 'FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout, conversion_rate TIMESERIES week SINCE -60d UNTIL today',
  funnel_by_device: 'FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout GROUP BY session_device_type SINCE -60d UNTIL today',
  by_landing: 'FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_completed_checkout GROUP BY landing_page_path SINCE -60d UNTIL today ORDER BY sessions DESC LIMIT 30',
  by_referrer: 'FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_completed_checkout GROUP BY referrer_source SINCE -60d UNTIL today ORDER BY sessions DESC LIMIT 15',
  product_views: 'FROM products SHOW view_sessions, cart_sessions, purchase_sessions GROUP BY product_title SINCE -60d UNTIL today ORDER BY view_sessions DESC LIMIT 40',
};

async function shopifyql(query) {
  try {
    const d = await gql(`query($q: String!) { shopifyqlQuery(query: $q) {
      tableData { columns { name } rows } parseErrors } }`, { q: query });
    return d.shopifyqlQuery;
  } catch (e) { return { error: e.message.slice(0, 500) }; }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const orders = await paginate(ORDERS_Q, (d) => d.orders);
  let abandoned = [];
  try { abandoned = await paginate(ABANDONED_Q, (d) => d.abandonedCheckouts); } catch (e) { abandoned = { error: e.message.slice(0, 500) }; }
  const ql = {};
  for (const [k, q] of Object.entries(QL)) ql[k] = await shopifyql(q);
  fs.writeFileSync(path.join(OUT, 'sales.json'), JSON.stringify({ orders, abandoned, ql }, null, 2));
  console.log(`pedidos=${orders.length} abandonados=${Array.isArray(abandoned) ? abandoned.length : 'ERR'}`);
  for (const [k, v] of Object.entries(ql)) console.log(k, v.error ? `ERR ${v.error.slice(0, 200)}` : v.parseErrors?.length ? `PARSE ${JSON.stringify(v.parseErrors).slice(0, 200)}` : `ok filas=${v.tableData?.rows?.length}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
