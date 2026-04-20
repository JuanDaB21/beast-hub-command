import type { RawMaterialWithRelations } from "@/features/sourcing/api";

export interface MaterialGroup {
  key: string;
  baseName: string;
  supplier: RawMaterialWithRelations["supplier"];
  category: RawMaterialWithRelations["category"];
  subcategory: RawMaterialWithRelations["subcategory"];
  variants: RawMaterialWithRelations[];
}

/** Extrae el nombre base eliminando los sufijos de color y talla. */
export function extractBaseName(m: RawMaterialWithRelations): string {
  let name = m.name;
  const stripSuffix = (text: string, suffix?: string | null) => {
    if (!suffix) return text;
    const re = new RegExp(`\\s*-\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    return text.replace(re, "");
  };
  name = stripSuffix(name, m.size?.label);
  name = stripSuffix(name, m.color?.name);
  return name.trim();
}

/** Agrupa raw_materials por proveedor + categoría + nombre base. */
export function groupMaterials(materials: RawMaterialWithRelations[]): MaterialGroup[] {
  const map = new Map<string, MaterialGroup>();
  materials.forEach((m) => {
    const baseName = extractBaseName(m);
    const key = `${m.supplier_id}::${m.category_id}::${baseName.toLowerCase()}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        baseName,
        supplier: m.supplier,
        category: m.category,
        subcategory: m.subcategory,
        variants: [],
      };
      map.set(key, g);
    }
    g.variants.push(m);
  });

  map.forEach((g) => {
    g.variants.sort((a, b) => {
      const so = (a.size?.sort_order ?? 9999) - (b.size?.sort_order ?? 9999);
      if (so !== 0) return so;
      return (a.color?.name ?? "").localeCompare(b.color?.name ?? "");
    });
  });

  return Array.from(map.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
}
