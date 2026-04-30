import type { PoolClient } from 'pg';
import { pool } from '../db';

// ---------------------------------------------------------------------------
// Normalization & key handling
// ---------------------------------------------------------------------------

/** lowercase, NFD strip diacritics, collapse whitespace, strip common prefixes. */
export function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(talla|size|colour|color)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the base_group_key.
 * Format matches the frontend's groupMaterials key: "{supplier_id}::{category_id}::{baseName.toLowerCase()}"
 */
export function buildBaseGroupKey(supplierId: string, categoryId: string, baseName: string): string {
  return `${supplierId}::${categoryId}::${baseName.toLowerCase()}`;
}

interface ParsedKey {
  supplier_id: string;
  category_id: string;
  base_name_norm: string;
}

export function parseBaseGroupKey(key: string): ParsedKey | null {
  const parts = key.split('::');
  if (parts.length !== 3) return null;
  const [supplier_id, category_id, base_name_norm] = parts;
  if (!supplier_id || !category_id || !base_name_norm) return null;
  return { supplier_id, category_id, base_name_norm };
}

// ---------------------------------------------------------------------------
// Color / size resolution
// ---------------------------------------------------------------------------

export async function resolveColorId(
  client: PoolClient | typeof pool,
  text: string | null | undefined
): Promise<string | null> {
  const norm = normalize(text);
  if (!norm) return null;

  const exact = await client.query<{ id: string }>(
    `SELECT id FROM colors WHERE LOWER(name) = $1 LIMIT 1`,
    [norm]
  );
  if (exact.rows[0]) return exact.rows[0].id;

  const alias = await client.query<{ color_id: string }>(
    `SELECT color_id FROM color_aliases WHERE alias_norm = $1 LIMIT 1`,
    [norm]
  );
  return alias.rows[0]?.color_id ?? null;
}

export async function resolveSizeId(
  client: PoolClient | typeof pool,
  text: string | null | undefined
): Promise<string | null> {
  const norm = normalize(text);
  if (!norm) return null;

  // Try standard size token first (XS/S/M/L/XL/XXL/2XL/numeric).
  const sizeToken = norm.match(/^(xxs|xs|s|m|l|xl|xxl|xxxl|\d+)$/i)?.[0]?.toUpperCase();

  const exact = await client.query<{ id: string }>(
    `SELECT id FROM sizes WHERE LOWER(label) = $1 OR (LOWER(label) = LOWER($2)) LIMIT 1`,
    [norm, sizeToken ?? norm]
  );
  if (exact.rows[0]) return exact.rows[0].id;

  const alias = await client.query<{ size_id: string }>(
    `SELECT size_id FROM size_aliases WHERE alias_norm = $1 LIMIT 1`,
    [norm]
  );
  return alias.rows[0]?.size_id ?? null;
}

// ---------------------------------------------------------------------------
// Raw material lookup
// ---------------------------------------------------------------------------

interface FindRmArgs {
  base_group_key: string;
  color_id: string | null;
  size_id: string | null;
}

export async function findRawMaterial(
  client: PoolClient | typeof pool,
  args: FindRmArgs
): Promise<string | null> {
  const parsed = parseBaseGroupKey(args.base_group_key);
  if (!parsed) return null;

  // Match by supplier+category+normalized name root, then color+size.
  // raw_materials.name typically includes color/size in the string ("Camiseta - Rojo - L"),
  // so we match by prefix on the normalized name (taking the part before the first " - ").
  const r = await client.query<{ id: string }>(
    `
    SELECT id FROM raw_materials
     WHERE supplier_id = $1
       AND category_id = $2
       AND (
         LOWER(SPLIT_PART(name, ' - ', 1)) = $3
         OR LOWER(name) = $3
       )
       AND COALESCE(color_id::text, '') = COALESCE($4::text, '')
       AND COALESCE(size_id::text, '') = COALESCE($5::text, '')
     LIMIT 1
    `,
    [parsed.supplier_id, parsed.category_id, parsed.base_name_norm, args.color_id, args.size_id]
  );
  return r.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// BOM materialization (the heart of FASE 9)
// ---------------------------------------------------------------------------

export interface LinkSpec {
  raw_material_id: string;
  print_design_id: string | null;
  print_height_cm: number;
}

/**
 * Wipe and rewrite product_materials rows for a child product based on a link spec.
 * Inserts: 1 base row (qty=1) + optional 1 ink row (qty = height × g/cm).
 * Also denormalizes print_design / print_color / print_design_id / print_height_cm onto
 * the products row so the existing UI keeps showing the same as for manually-created variants.
 */
export async function materializeBom(
  client: PoolClient,
  productId: string,
  spec: LinkSpec
): Promise<void> {
  await client.query(`DELETE FROM product_materials WHERE product_id = $1`, [productId]);

  // Base row — always.
  await client.query(
    `INSERT INTO product_materials (product_id, raw_material_id, quantity_required)
     VALUES ($1, $2, 1)
     ON CONFLICT (product_id, raw_material_id) DO UPDATE SET quantity_required = EXCLUDED.quantity_required`,
    [productId, spec.raw_material_id]
  );

  // Optional ink row.
  let inkName: string | null = null;
  let inkHex: string | null = null;
  if (spec.print_design_id && spec.print_height_cm > 0) {
    const d = await client.query<{
      name: string;
      hex_code: string;
      ink_raw_material_id: string | null;
      ink_grams_per_cm: string;
    }>(
      `SELECT name, hex_code, ink_raw_material_id, ink_grams_per_cm
         FROM print_designs WHERE id = $1`,
      [spec.print_design_id]
    );
    const design = d.rows[0];
    if (design) {
      inkName = design.name;
      inkHex = design.hex_code;
      if (design.ink_raw_material_id) {
        const inkQty = Number(design.ink_grams_per_cm) * spec.print_height_cm;
        if (inkQty > 0 && design.ink_raw_material_id !== spec.raw_material_id) {
          await client.query(
            `INSERT INTO product_materials (product_id, raw_material_id, quantity_required)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, raw_material_id) DO UPDATE SET quantity_required = EXCLUDED.quantity_required`,
            [productId, design.ink_raw_material_id, inkQty]
          );
        }
      }
    }
  }

  // Denormalize onto products row for display parity with manual creation.
  await client.query(
    `UPDATE products
        SET print_design_id = $1,
            print_design = $2,
            print_color = $3,
            print_height_cm = $4,
            updated_at = now()
      WHERE id = $5`,
    [spec.print_design_id, inkName, inkHex, spec.print_height_cm, productId]
  );
}

// ---------------------------------------------------------------------------
// Link upsert + bulk auto-link
// ---------------------------------------------------------------------------

export interface LinkInput {
  product_id: string;
  raw_material_id: string;
  print_design_id?: string | null;
  print_height_cm?: number;
  link_source?: 'auto' | 'wizard' | 'manual';
  linked_by?: string | null;
}

export async function upsertLinkAndMaterialize(
  client: PoolClient,
  input: LinkInput
): Promise<void> {
  const printDesignId = input.print_design_id ?? null;
  const printHeight = input.print_height_cm ?? 0;
  const source = input.link_source ?? 'manual';

  await client.query(
    `INSERT INTO product_base_links
       (product_id, raw_material_id, print_design_id, print_height_cm, link_source, linked_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (product_id) DO UPDATE
       SET raw_material_id = EXCLUDED.raw_material_id,
           print_design_id = EXCLUDED.print_design_id,
           print_height_cm = EXCLUDED.print_height_cm,
           link_source = EXCLUDED.link_source,
           linked_by = EXCLUDED.linked_by,
           linked_at = now()`,
    [input.product_id, input.raw_material_id, printDesignId, printHeight, source, input.linked_by ?? null]
  );

  await materializeBom(client, input.product_id, {
    raw_material_id: input.raw_material_id,
    print_design_id: printDesignId,
    print_height_cm: printHeight,
  });
}

interface UnresolvedChild {
  child_id: string;
  sku: string;
  base_color: string | null;
  size: string | null;
  reason: 'no_color_match' | 'no_size_match' | 'no_raw_material_match';
}

export interface BulkAutoLinkResult {
  parent_id: string;
  linked: number;
  unresolved: UnresolvedChild[];
}

/**
 * For every child of `parent_id`, attempt to resolve color/size text → raw_material
 * using the parent's base_group_key. Idempotent: re-running with the same data is a no-op.
 *
 * Skips silently if the parent has no base_group_key (used by syncProducts to gate auto-link).
 */
export async function bulkAutoLink(
  client: PoolClient,
  parentId: string,
  options?: { default_print_design_id?: string | null; default_print_height_cm?: number }
): Promise<BulkAutoLinkResult> {
  const parentRow = await client.query<{
    base_group_key: string | null;
    print_design_id: string | null;
    print_height_cm: string | null;
  }>(
    `SELECT base_group_key, print_design_id, print_height_cm
       FROM products WHERE id = $1`,
    [parentId]
  );
  const parent = parentRow.rows[0];
  if (!parent || !parent.base_group_key) {
    return { parent_id: parentId, linked: 0, unresolved: [] };
  }

  const designId = options?.default_print_design_id !== undefined
    ? options.default_print_design_id
    : parent.print_design_id;
  const printHeight = options?.default_print_height_cm !== undefined
    ? options.default_print_height_cm
    : Number(parent.print_height_cm ?? 0);

  const children = await client.query<{
    id: string;
    sku: string;
    base_color: string | null;
    size: string | null;
  }>(
    `SELECT id, sku, base_color, size
       FROM products WHERE parent_id = $1 AND is_parent = false`,
    [parentId]
  );

  const result: BulkAutoLinkResult = { parent_id: parentId, linked: 0, unresolved: [] };

  for (const child of children.rows) {
    const colorId = await resolveColorId(client, child.base_color);
    const sizeId = await resolveSizeId(client, child.size);

    if (child.base_color && !colorId) {
      result.unresolved.push({ child_id: child.id, sku: child.sku, base_color: child.base_color, size: child.size, reason: 'no_color_match' });
      continue;
    }
    if (child.size && !sizeId) {
      result.unresolved.push({ child_id: child.id, sku: child.sku, base_color: child.base_color, size: child.size, reason: 'no_size_match' });
      continue;
    }

    const rmId = await findRawMaterial(client, {
      base_group_key: parent.base_group_key,
      color_id: colorId,
      size_id: sizeId,
    });

    if (!rmId) {
      result.unresolved.push({ child_id: child.id, sku: child.sku, base_color: child.base_color, size: child.size, reason: 'no_raw_material_match' });
      continue;
    }

    await upsertLinkAndMaterialize(client, {
      product_id: child.id,
      raw_material_id: rmId,
      print_design_id: designId,
      print_height_cm: printHeight,
      link_source: 'auto',
    });
    result.linked++;
  }

  return result;
}

/** Re-materialize BOM of all linked children of a parent — preserves raw_material_id, swaps ink. */
export async function relinkChildrenByPrintDesign(
  client: PoolClient,
  parentId: string,
  printDesignId: string | null,
  printHeightCm: number
): Promise<void> {
  const children = await client.query<{ product_id: string; raw_material_id: string }>(
    `SELECT pbl.product_id, pbl.raw_material_id
       FROM product_base_links pbl
       JOIN products p ON p.id = pbl.product_id
      WHERE p.parent_id = $1`,
    [parentId]
  );
  for (const c of children.rows) {
    await client.query(
      `UPDATE product_base_links
          SET print_design_id = $1, print_height_cm = $2, linked_at = now()
        WHERE product_id = $3`,
      [printDesignId, printHeightCm, c.product_id]
    );
    await materializeBom(client, c.product_id, {
      raw_material_id: c.raw_material_id,
      print_design_id: printDesignId,
      print_height_cm: printHeightCm,
    });
  }
}
