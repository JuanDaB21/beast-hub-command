// Lista de checkouts abandonados para recuperar por WhatsApp (solo lectura).
// Excluye a quien ya compró después (mismo teléfono o email en un pedido posterior).
// Salida: .out/recuperacion-whatsapp.html (contiene datos personales: NO publicar ni versionar).
// Uso: node scripts/shopify-cro/abandoned-whatsapp.cjs [días=30]
const fs = require('fs');
const path = require('path');
const { paginate } = require('./shopifyCro.cjs');

const DAYS = Number(process.argv[2] || 30);
const since = new Date(Date.now() - DAYS * 864e5);

const normPhone = (p) => {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('57') && d.length === 12) return d;
  if (d.length === 10 && d.startsWith('3')) return '57' + d;
  return d;
};
const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async () => {
  const abandoned = await paginate(`query($after: String) { abandonedCheckouts(first: 100, after: $after, reverse: true) {
    nodes { createdAt completedAt abandonedCheckoutUrl
      totalPriceSet { shopMoney { amount } }
      customer { firstName email phone }
      shippingAddress { firstName phone city }
      lineItems(first: 10) { nodes { title quantity variantTitle } } }
    pageInfo { hasNextPage endCursor } } }`, (d) => d.abandonedCheckouts);

  const orders = await paginate(`query($after: String) { orders(first: 100, after: $after, reverse: true, sortKey: CREATED_AT, query: "created_at:>=${since.toISOString().slice(0, 10)}") {
    nodes { createdAt email phone shippingAddress { phone } } pageInfo { hasNextPage endCursor } } }`, (d) => d.orders);

  const rows = [];
  const seen = new Set();
  for (const a of abandoned) {
    const at = new Date(a.createdAt);
    if (a.completedAt || at < since) continue;
    const phone = normPhone(a.shippingAddress?.phone || a.customer?.phone);
    const email = (a.customer?.email || '').toLowerCase();
    if (!phone) continue;
    const key = phone;
    if (seen.has(key)) continue; // un contacto por persona (el más reciente)
    const boughtLater = orders.some((o) => new Date(o.createdAt) > at && (
      normPhone(o.phone || o.shippingAddress?.phone) === phone || (email && (o.email || '').toLowerCase() === email)));
    if (boughtLater) continue;
    seen.add(key);
    const name = (a.shippingAddress?.firstName || a.customer?.firstName || '').trim().split(' ')[0];
    const items = a.lineItems.nodes.map((l) => `${l.quantity}× ${l.title}${l.variantTitle ? ` (${l.variantTitle})` : ''}`);
    const first = a.lineItems.nodes[0]?.title || 'tu pedido';
    const msg = `Hola${name ? ' ' + name : ''} 👋 Te escribimos de Beast Club. Vimos que dejaste ${first} en tu carrito. ¡Todavía lo tenemos apartado para ti! 💪 ` +
      `Puedes pagar contra entrega en la puerta de tu casa. Termina tu compra aquí: ${a.abandonedCheckoutUrl} ¿Te ayudo con la talla o con algo más?`;
    rows.push({ at, name, city: a.shippingAddress?.city || '', phone, total: Number(a.totalPriceSet.shopMoney.amount), items, wa: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` });
  }

  const total = rows.reduce((s, r) => s + r.total, 0);
  const html = `<!doctype html><meta charset="utf-8"><title>Recuperación WhatsApp</title>
<style>body{font:14px system-ui;margin:16px;background:#fff;color:#111}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}a.btn{background:#25d366;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;white-space:nowrap}small{color:#666}</style>
<h2>Checkouts abandonados sin compra posterior — últimos ${DAYS} días</h2>
<p>${rows.length} contactos · ${money(total)} en carritos · generado ${new Date().toLocaleString('es-CO')}</p>
<table><tr><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Valor</th><th></th></tr>
${rows.map((r) => `<tr><td>${r.at.toLocaleDateString('es-CO')}</td><td>${esc(r.name)}<br><small>${esc(r.city)}</small></td><td>${r.items.map(esc).join('<br>')}</td><td>${money(r.total)}</td><td><a class="btn" href="${r.wa}" target="_blank">WhatsApp</a></td></tr>`).join('\n')}
</table>`;
  const out = path.join(__dirname, '.out', 'recuperacion-whatsapp.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${rows.length} contactos a recuperar · ${money(total)} · ${out}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
