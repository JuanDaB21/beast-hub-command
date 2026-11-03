// Descarga todos los archivos de un tema a una carpeta local (respaldo / edición).
// Uso: node scripts/shopify-cro/theme-pull.cjs [MAIN|<themeId numérico>] [carpeta destino]
// Por defecto: tema MAIN → ../beastclub-theme (repo git aparte).
const fs = require('fs');
const path = require('path');
const { gql, ROOT } = require('./shopifyCro.cjs');

const target = process.argv[2] || 'MAIN';
const outDir = path.resolve(process.argv[3] || path.join(ROOT, '..', 'beastclub-theme'));

const FILES_Q = `query($id: ID!, $after: String) {
  theme(id: $id) { files(first: 100, after: $after) {
    nodes { filename body {
      ... on OnlineStoreThemeFileBodyText { content }
      ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
      ... on OnlineStoreThemeFileBodyUrl { url }
    } }
    pageInfo { hasNextPage endCursor }
  } }
}`;

(async () => {
  const { themes } = await gql(`{ themes(first: 50) { nodes { id name role } } }`);
  const theme = target === 'MAIN'
    ? themes.nodes.find((t) => t.role === 'MAIN')
    : themes.nodes.find((t) => t.id.endsWith(`/${target}`));
  if (!theme) throw new Error(`Tema no encontrado: ${target}`);

  let after = null;
  let count = 0;
  do {
    const conn = (await gql(FILES_Q, { id: theme.id, after })).theme.files;
    for (const f of conn.nodes) {
      const dest = path.join(outDir, f.filename);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const b = f.body || {};
      if (b.content !== undefined) fs.writeFileSync(dest, b.content);
      else if (b.contentBase64 !== undefined) fs.writeFileSync(dest, Buffer.from(b.contentBase64, 'base64'));
      else if (b.url) fs.writeFileSync(dest, Buffer.from(await (await fetch(b.url)).arrayBuffer()));
      count++;
    }
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (after);

  fs.writeFileSync(path.join(outDir, '.theme.json'), JSON.stringify({ ...theme, pulledAt: new Date().toISOString() }, null, 2));
  console.log(`${count} archivos de "${theme.name}" [${theme.role}] → ${outDir}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
