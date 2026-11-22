// Verifica en Shopify lo que subió photos-run.cjs --upload: por producto, portada (nueva o no, proporción 4:5),
// número de fotos, variantes sin foto o con foto de otro color, fotos sin alt; y que los packs sigan vendibles.
//   node scripts/shopify-cro/photos-verify.cjs
const { gql } = require('./shopifyCro.cjs');
const nj = require('./nightjar.cjs');
const plan = require('./photos-plan.json');

(async () => {
  const state = nj.loadState();
  const uploaded = new Set(Object.values(state.uploads || {}));
  const handles = [...new Set(plan.products.map((p) => p.handle))];
  let issues = 0;
  for (const h of handles) {
    const p = (await gql(`query($h:String!){ productByHandle(handle:$h){ status
      media(first:100){ nodes{ id alt status ... on MediaImage{ image{ width height } } } }
      variants(first:100){ nodes{ title selectedOptions{ name value } media(first:1){ nodes{ id alt } } } } } }`, { h })).productByHandle;
    const m = p.media.nodes;
    const first = m[0];
    const ratio = first.image ? (first.image.width / first.image.height).toFixed(2) : '?';
    const shoot = plan.products.some((e) => e.handle === h && e.shots.some((s) => s.mode === 'photoshoot'));
    const bad = [];
    if (shoot && !uploaded.has(first.id)) bad.push('portada no es nueva');
    if (shoot && Math.abs(ratio - 0.8) > 0.016) bad.push(`portada ${ratio}`);
    if (m.length < 4) bad.push(`${m.length} fotos`);
    if (m.some((x) => x.status !== 'READY')) bad.push('media sin procesar');
    const noAlt = m.filter((x) => uploaded.has(x.id) && !x.alt).length;
    if (noAlt) bad.push(`${noAlt} nuevas sin alt`);
    // Cada variante de un color con foto nueva debe apuntar a una foto nueva de ese mismo color.
    const norm = (x) => x.replace(/\s+/g, ' ').replace(/ ?\/ ?/g, '/').trim().toLowerCase();
    const planned = new Set(plan.products.filter((e) => e.handle === h).map((e) => norm(e.color)));
    const wrong = p.variants.nodes.filter((v) => {
      const c = norm(v.selectedOptions.find((o) => /color/i.test(o.name))?.value || '');
      if (!planned.has(c)) return false;
      const vm = v.media.nodes[0];
      return !vm || !uploaded.has(vm.id) || !norm(vm.alt || '').includes(c);
    });
    if (wrong.length) bad.push(`${wrong.length} variantes sin su foto (${wrong.slice(0, 2).map((v) => v.title).join('; ')})`);
    issues += bad.length;
    console.log(`${bad.length ? '✗' : '✓'} ${h} [${p.status}] fotos=${m.length} portada=${uploaded.has(first.id) ? 'nueva' : 'vieja'} ${ratio}${bad.length ? ' → ' + bad.join(', ') : ''}`);
  }

  // Curaduría (photos-curation.json): portada del color ganador y del lado del estampado, sin fotos viejas
  // de colores con foto nueva, cada variante con una foto de su color y todo lo nuevo en WebP.
  const curFile = require('path').join(__dirname, 'photos-curation.json');
  if (require('fs').existsSync(curFile)) {
    const cur = JSON.parse(require('fs').readFileSync(curFile, 'utf8'));
    console.log('\nCuraduría:');
    for (const [h, c] of Object.entries(cur)) {
      const p = (await gql(`query($h:String!){ productByHandle(handle:$h){ media(first:100){ nodes{ id ... on MediaImage{ mimeType } } }
        variants(first:100){ nodes{ title selectedOptions{ name value } media(first:1){ nodes{ id } } } } } }`, { h })).productByHandle;
      const bad = [];
      const info = (id) => c.media[id] || {};
      const winner = c.winner || c.winner_auto;
      const hero = info(p.media.nodes[0].id);
      if (hero.color !== winner) bad.push(`portada ${hero.color} ≠ ${winner}`);
      if (c.print_side && hero.view !== c.print_side) bad.push(`portada de ${hero.view}, estampado en ${c.print_side}`);
      const newColors = new Set(Object.values(c.media).filter((m) => m.isNew).map((m) => m.color));
      const stale = p.media.nodes.filter((m) => !info(m.id).isNew && newColors.has(info(m.id).color));
      if (c.in_plan && stale.length) bad.push(`${stale.length} viejas de colores con foto nueva`);
      const notWebp = p.media.nodes.filter((m) => info(m.id).isNew && m.mimeType !== 'image/webp');
      if (notWebp.length) bad.push(`${notWebp.length} nuevas no WebP`);
      const withPhoto = new Set(p.media.nodes.map((m) => info(m.id).color).filter(Boolean));
      const wrong = p.variants.nodes.filter((v) => {
        const col = v.selectedOptions.find((o) => /color/i.test(o.name))?.value;
        return withPhoto.has(col) && info(v.media.nodes[0]?.id).color !== col;
      });
      if (wrong.length) bad.push(`${wrong.length} variantes con foto de otro color`);
      issues += bad.length;
      console.log(`${bad.length ? '✗' : '✓'} ${h} portada=${hero.color} · ${hero.view}${bad.length ? ' → ' + bad.join(', ') : ''}`);
    }
  }

  // Packs: todos los activos deben seguir con todas sus variantes vendibles.
  const packs = (await gql(`{ products(first:100, query:"product_type:Pack AND status:active"){ nodes{ handle
    variants(first:100){ nodes{ availableForSale } } } } }`)).products.nodes;
  const off = packs.filter((x) => x.variants.nodes.some((v) => !v.availableForSale));
  console.log(`\nPacks activos: ${packs.length}, con variantes no vendibles: ${off.length}${off.length ? ' → ' + off.map((x) => x.handle).join(', ') : ''}`);
  process.exit(issues || off.length ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
