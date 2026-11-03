// Verifica la conexión de la app "Beast CRO": token, tienda y scopes concedidos.
// Uso: node scripts/shopify-cro/verify.cjs
const { gql, getToken } = require('./shopifyCro.cjs');

(async () => {
  const t = await getToken();
  const d = await gql(`{
    shop { name myshopifyDomain plan { displayName } currencyCode }
    currentAppInstallation { accessScopes { handle } }
    themes(first: 20) { nodes { id name role } }
  }`);
  console.log('Tienda:', d.shop.name, `(${d.shop.myshopifyDomain})`, '· plan', d.shop.plan.displayName, '·', d.shop.currencyCode);
  console.log('Token expira en (s):', t.expires_in ?? 'n/d');
  console.log('Scopes:', d.currentAppInstallation.accessScopes.map((s) => s.handle).sort().join(', '));
  console.log('Temas:', d.themes.nodes.map((x) => `${x.name} [${x.role}]`).join(' | '));
})().catch((e) => { console.error(e.message); process.exit(1); });
