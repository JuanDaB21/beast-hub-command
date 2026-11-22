// Reactiva colores agotados y crea variantes nuevas: Beast Hub (materia prima, estampados, producto, BOM,
// procesos) + Shopify (variantes nuevas, SKU = SKU de Beast Hub, precio y "sin seguimiento").
// Config: reactivate.json. Idempotente: lo que ya existe (por nombre/SKU) no se duplica.
// Uso: node scripts/shopify-cro/reactivate.cjs            dry-run: corre todo en una transacción y hace ROLLBACK;
//                                                         Shopify no se toca. Imprime la tabla para revisión.
//      node scripts/shopify-cro/reactivate.cjs --apply    crea variantes en Shopify, COMMIT en Beast Hub y
//                                                         actualiza SKU/precio/seguimiento en Shopify.
// No cambia el estado de ningún producto (CRACKED pasa a ACTIVE cuando tenga fotos) ni toca packs.
const { Client } = require('pg');
const { gql } = require('./shopifyCro.cjs');
const { dbUrl } = require('../analytics/db.cjs');
const cfg = require('./reactivate.json');

const APPLY = process.argv.includes('--apply');
const BASE_SIZES = ['S', 'M', 'L', 'XL'];
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s"]/g, '');
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const ceil900 = (x) => Math.ceil((x - 900) / 1000) * 1000 + 900;
const numId = (gid) => (gid ? gid.split('/').pop() : null);

const PRODUCT_Q = `query($h: String!) { productByHandle(handle: $h) { id handle status title
  options { id name values linkedMetafield { namespace key } optionValues { name linkedMetafieldValue } }
  variants(first: 100) { nodes { id title price compareAtPrice selectedOptions { name value } inventoryItem { id sku tracked } } } } }`;

const optOf = (v, re) => v.selectedOptions.find((o) => re.test(o.name))?.value;
const SIZE_RE = /^(talla|size)$/i;
const COLOR_RE = /^color$/i;

// Opciones enlazadas a metaobjetos de categoría (shopify.color-pattern / shopify.size): el valor tiene que
// existir en la opción del producto antes de crear la variante, y la variante lo referencia solo por nombre.
// Se reutiliza un metaobjeto existente con la misma etiqueta (p. ej. los de CRACKED); si no hay, se crea.
async function findOrCreateMetaobject(type, label, hex) {
  let after = null;
  do {
    const d = await gql(`query($t: String!, $a: String) { metaobjects(type: $t, first: 250, after: $a) {
      nodes { id displayName } pageInfo { hasNextPage endCursor } } }`, { t: type, a: after });
    const hit = d.metaobjects.nodes.find((m) => norm(m.displayName) === norm(label));
    if (hit) return hit.id;
    after = d.metaobjects.pageInfo.hasNextPage ? d.metaobjects.pageInfo.endCursor : null;
  } while (after);
  if (type !== 'shopify--color-pattern') throw new Error(`No hay metaobjeto ${type} "${label}"`);
  const r = (await gql(`mutation($m: MetaobjectCreateInput!) { metaobjectCreate(metaobject: $m) { metaobject { id } userErrors { message } } }`, {
    m: { type, fields: [{ key: 'label', value: label }, { key: 'color', value: hex },
      { key: 'color_taxonomy_reference', value: '["gid://shopify/TaxonomyValue/1"]' },
      { key: 'pattern_taxonomy_reference', value: 'gid://shopify/TaxonomyValue/2874' }] },
  })).metaobjectCreate;
  if (r.userErrors.length) throw new Error(`metaobjectCreate ${label}: ${JSON.stringify(r.userErrors)}`);
  return r.metaobject.id;
}

async function optionValue(productId, opt, label, hex = '#000000') {
  const own = opt.optionValues.find((v) => norm(v.name) === norm(label));
  if (own || !opt.linkedMetafield) return { optionName: opt.name, name: own?.name ?? label };
  const moId = await findOrCreateMetaobject(`shopify--${opt.linkedMetafield.key}`, label, hex);
  const r = (await gql(`mutation($pid: ID!, $o: OptionUpdateInput!, $add: [OptionValueCreateInput!]) {
    productOptionUpdate(productId: $pid, option: $o, optionValuesToAdd: $add, variantStrategy: LEAVE_AS_IS) {
      product { options { id name optionValues { name linkedMetafieldValue } } } userErrors { field message } } }`,
  { pid: productId, o: { id: opt.id }, add: [{ linkedMetafieldValue: moId }] })).productOptionUpdate;
  if (r.userErrors.length) throw new Error(`productOptionUpdate ${label}: ${JSON.stringify(r.userErrors)}`);
  const updated = r.product.options.find((o) => o.id === opt.id);
  opt.optionValues = updated.optionValues;
  const added = updated.optionValues.find((v) => v.linkedMetafieldValue === moId);
  return { optionName: opt.name, name: added.name };
}

async function main() {
  const db = new Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = (sql, p) => db.query(sql, p).then((r) => r.rows);
  const one = async (sql, p) => (await q(sql, p))[0];
  const report = [];
  const shopifyOps = []; // {product, updates:[], creates:[]}

  try {
    await db.query('BEGIN');
    const ppm = Number((await one(`SELECT value FROM global_configs WHERE id='printing_cost_per_meter'`)).value);

    // 1) Materia prima nueva (Vega Penn slim)
    for (const rm of cfg.new_raw_materials) {
      const sup = await one(`SELECT id FROM suppliers WHERE name=$1`, [rm.supplier]);
      const cat = await one(`SELECT id FROM categories WHERE name=$1`, [rm.category]);
      if (!sup || !cat) throw new Error(`Falta proveedor/categoría ${rm.supplier}/${rm.category}`);
      let sub = await one(`SELECT id FROM subcategories WHERE name=$1 AND category_id=$2`, [rm.subcategory, cat.id]);
      sub ??= await one(`INSERT INTO subcategories (name, category_id) VALUES ($1,$2) RETURNING id`, [rm.subcategory, cat.id]);
      for (const c of rm.colors) {
        const color = await one(`SELECT id FROM colors WHERE name=$1`, [c.color]);
        for (const s of rm.sizes) {
          const name = `${rm.name} - ${c.label} - ${s}`;
          if (await one(`SELECT id FROM raw_materials WHERE name=$1`, [name])) continue;
          const size = await one(`SELECT id FROM sizes WHERE label=$1`, [s]);
          await q(`INSERT INTO raw_materials (supplier_id, category_id, subcategory_id, color_id, size_id, name, unit_price, unit_of_measure, stock)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,'unit',0)`, [sup.id, cat.id, sub.id, color?.id ?? null, size?.id ?? null, name, rm.unit_price]);
          report.push(`MP nueva: ${name} (${rm.unit_price})`);
        }
      }
    }

    // 2) Estampados nuevos (padre → hijos por color)
    for (const d of cfg.new_designs) {
      let parent = await one(`SELECT id FROM print_designs WHERE name=$1`, [d.name]);
      if (!parent) {
        parent = await one(`INSERT INTO print_designs (name, hex_code) VALUES ($1,$2) RETURNING id`, [d.name, d.hex]);
        report.push(`Estampado nuevo: ${d.name}`);
      }
      for (const ch of d.children ?? []) {
        if (await one(`SELECT id FROM print_designs WHERE name=$1`, [ch.name])) continue;
        await q(`INSERT INTO print_designs (name, hex_code, parent_design_id) VALUES ($1,$2,$3)`, [ch.name, ch.hex, parent.id]);
        report.push(`Estampado nuevo: ${ch.name} (hijo de ${d.name})`);
      }
    }

    // 3) Productos
    for (const P of cfg.products) {
      const sp = (await gql(PRODUCT_Q, { h: P.handle })).productByHandle;
      if (!sp) throw new Error(`No existe en Shopify: ${P.handle}`);
      const op = { product: sp, updates: [], creates: [] };
      shopifyOps.push(op);

      let parent = await one(`SELECT * FROM products WHERE lower(sku)=lower($1) AND is_parent`, [P.bh_parent.sku]);
      if (!parent) {
        if (!P.bh_parent.create) throw new Error(`No existe el padre en Beast Hub: ${P.bh_parent.sku}`);
        parent = await one(`INSERT INTO products (sku, name, is_parent, active, stock, safety_stock, product_url, shopify_product_id)
          VALUES ($1,$2,true,true,0,0,$3,$4) RETURNING *`, [P.bh_parent.sku, P.bh_parent.name, `https://beastclub.store/products/${P.handle}`, numId(sp.id)]);
        report.push(`Padre nuevo BH: ${parent.name}`);
      }
      let processIds = [];
      if (P.processes === 'copy_from_sibling') {
        processIds = (await q(`SELECT DISTINCT x.process_id FROM product_processes x JOIN products c ON c.id=x.product_id WHERE c.parent_id=$1`, [parent.id])).map((r) => r.process_id);
      }

      for (const C of P.colors) {
        const design = await one(`SELECT * FROM print_designs WHERE name=$1`, [C.design]);
        if (!design) throw new Error(`Estampado no existe: ${C.design}`);
        const svs = sp.variants.nodes.filter((v) => norm(optOf(v, COLOR_RE)) === norm(C.shopify));
        if (!C.create_in_shopify && !svs.length) throw new Error(`${P.handle}: color no encontrado en Shopify: ${C.shopify}`);
        const sizes = [...BASE_SIZES, ...Object.keys(C.sizes_extra ?? {})];
        for (const size of sizes) {
          const rmSize = C.sizes_extra?.[size] ?? size;
          const sv = svs.find((v) => optOf(v, SIZE_RE) === size);
          if (!sv && !C.create_in_shopify) continue;
          const rm = await one(`SELECT * FROM raw_materials WHERE name=$1`, [`${C.base} - ${rmSize}`]);
          if (!rm) throw new Error(`Base no existe: ${C.base} - ${rmSize}`);
          const cost = Number(rm.unit_price) + (P.print_height_cm * ppm) / 100;
          const price = P.keep_price
            ? Number(sv?.price ?? sp.variants.nodes[0].price)
            : ceil900(cost + cfg.margen_bruto);
          const bhSize = rmSize;
          const sku = `${P.bh_parent.sku.toUpperCase()}-${slug(C.base_color)}-${bhSize}-${slug(C.design)}`;
          const name = `${parent.name} ${C.base_color} ${bhSize} / ${C.design}`;

          let child = await one(`SELECT * FROM products WHERE lower(sku)=lower($1)`, [sku]);
          if (!child) {
            child = await one(`INSERT INTO products (sku, name, description, product_url, active, base_color, size, print_color,
                print_design, print_design_id, print_height_cm, stock, safety_stock, aging_days, price, cost, parent_id, is_parent,
                shopify_product_id, shopify_variant_id, shopify_inventory_item_id)
              VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,0,0,30,$11,$12,$13,false,$14,$15,$16) RETURNING *`,
            [sku, name, parent.description, parent.product_url ?? `https://beastclub.store/products/${P.handle}`, C.base_color, bhSize,
              design.hex_code, design.name, design.id, P.print_height_cm, price, cost, parent.id,
              numId(sp.id), numId(sv?.id), numId(sv?.inventoryItem.id)]);
            await q(`INSERT INTO product_materials (product_id, raw_material_id, quantity_required, role) VALUES ($1,$2,1,'base')`, [child.id, rm.id]);
            for (const pid of processIds) await q(`INSERT INTO product_processes (product_id, process_id) VALUES ($1,$2)`, [child.id, pid]);
          }

          const cmp = sv?.compareAtPrice && Number(sv.compareAtPrice) > price ? sv.compareAtPrice : null;
          if (sv) op.updates.push({ id: sv.id, price: String(price), compareAtPrice: cmp, inventoryItem: { sku, tracked: false } });
          else op.creates.push({ color: C.shopify, hex: design.hex_code, size, price: String(price), sku, childId: child.id,
            compareAtPrice: sp.variants.nodes[0].compareAtPrice });
          report.push([P.handle, C.shopify, size, sku, `base ${rm.name} ${Number(rm.unit_price)}`, `costo ${cost}`,
            `precio ${sv?.price ?? '-'} → ${price}`, `bruto ${price - cost}`, sv ? 'actualiza' : 'CREA en Shopify'].join(' | '));
        }
      }
    }

    if (!APPLY) {
      await db.query('ROLLBACK');
      console.log(report.join('\n'));
      console.log('\nDry-run: ROLLBACK en Beast Hub; Shopify sin cambios. Usar --apply.');
      return;
    }

    // 4) Shopify: crear variantes nuevas y enlazar sus IDs en Beast Hub (dentro de la transacción).
    for (const op of shopifyOps) {
      if (!op.creates.length) continue;
      const colorOpt = op.product.options.find((o) => COLOR_RE.test(o.name));
      const sizeOpt = op.product.options.find((o) => SIZE_RE.test(o.name));
      const values = [];
      for (const c of op.creates) {
        values.push([await optionValue(op.product.id, colorOpt, c.color, c.hex), await optionValue(op.product.id, sizeOpt, c.size)]);
      }
      const r = (await gql(`mutation($pid: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkCreate(productId: $pid, variants: $v) {
          productVariants { id inventoryItem { id sku } } userErrors { field message } } }`, {
        pid: op.product.id,
        v: op.creates.map((c, i) => ({ optionValues: values[i],
          price: c.price, compareAtPrice: c.compareAtPrice, inventoryPolicy: 'DENY', inventoryItem: { sku: c.sku, tracked: false } })),
      })).productVariantsBulkCreate;
      if (r.userErrors.length) throw new Error(`${op.product.handle}: ${JSON.stringify(r.userErrors)}`);
      for (const v of r.productVariants) {
        const c = op.creates.find((x) => x.sku === v.inventoryItem.sku);
        await q(`UPDATE products SET shopify_variant_id=$1, shopify_inventory_item_id=$2 WHERE id=$3`, [numId(v.id), numId(v.inventoryItem.id), c.childId]);
      }
      console.log(`Shopify: ${r.productVariants.length} variantes creadas en ${op.product.handle}`);
    }
    await db.query('COMMIT');
    console.log('Beast Hub: COMMIT');

    // 5) Shopify: SKU, precio, compare-at y sin seguimiento en las variantes existentes.
    for (const op of shopifyOps) {
      if (!op.updates.length) continue;
      const r = (await gql(`mutation($pid: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $pid, variants: $v) {
          productVariants { id } userErrors { field message } } }`, { pid: op.product.id, v: op.updates })).productVariantsBulkUpdate;
      if (r.userErrors.length) throw new Error(`${op.product.handle}: ${JSON.stringify(r.userErrors)}`);
      console.log(`Shopify: ${op.updates.length} variantes actualizadas en ${op.product.handle}`);
    }
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
