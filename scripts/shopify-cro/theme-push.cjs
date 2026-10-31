// Sube archivos locales a un tema NO publicado. Se niega a escribir sobre el tema MAIN.
// Uso: node scripts/shopify-cro/theme-push.cjs <themeId numérico> <archivo relativo>... [--dir carpeta]
const fs = require('fs');
const path = require('path');
const { gql, ROOT } = require('./shopifyCro.cjs');

const args = process.argv.slice(2);
const dirFlag = args.indexOf('--dir');
const dir = path.resolve(dirFlag >= 0 ? args.splice(dirFlag, 2)[1] : path.join(ROOT, '..', 'beastclub-theme'));
const [themeNum, ...files] = args;
if (!themeNum || !files.length) throw new Error('Uso: theme-push.cjs <themeId> <archivo>...');
const themeId = `gid://shopify/OnlineStoreTheme/${themeNum}`;

(async () => {
  const { theme } = await gql(`query($id: ID!) { theme(id: $id) { name role } }`, { id: themeId });
  if (!theme) throw new Error(`Tema ${themeNum} no existe`);
  if (theme.role === 'MAIN') throw new Error('Bloqueado: no se escribe sobre el tema publicado (MAIN).');

  const payload = files.map((f) => ({
    filename: f.replace(/\\/g, '/'),
    body: { type: 'TEXT', value: fs.readFileSync(path.join(dir, f), 'utf8') },
  }));
  const d = await gql(`mutation($id: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $id, files: $files) {
      upsertedThemeFiles { filename }
      userErrors { filename code message }
    } }`, { id: themeId, files: payload });
  const r = d.themeFilesUpsert;
  if (r.userErrors.length) { console.error(JSON.stringify(r.userErrors, null, 2)); process.exit(1); }
  console.log(`"${theme.name}" ← ${r.upsertedThemeFiles.map((f) => f.filename).join(', ')}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
