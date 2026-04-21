import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  stock: number;
  safety_stock: number;
  aging_days: number;
  price: number;
  cost: number;
  active: boolean;
  product_url: string | null;
  base_color: string | null;
  print_color: string | null;
  size: string | null;
  print_height_cm: number;
  parent_id: string | null;
  is_parent: boolean;
  print_design: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  description?: string | null;
  stock: number;
  safety_stock: number;
  aging_days: number;
  price: number;
  cost: number;
  active: boolean;
  product_url?: string | null;
  base_color?: string | null;
  print_color?: string | null;
  size?: string | null;
  print_height_cm?: number;
  parent_id?: string | null;
  is_parent?: boolean;
  print_design?: string | null;
}

export interface ProductWithChildren extends Product {
  children: Product[];
}

const QK = ["products"] as const;

export function useProducts() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

/** Devuelve productos agrupados como árbol padre→hijos.
 *  - parents: productos con is_parent=true (con sus children)
 *  - orphans: productos legacy sin padre y que no son padre */
export function useProductTree() {
  const q = useProducts();
  const products = q.data ?? [];
  const parentsMap = new Map<string, ProductWithChildren>();
  const childrenByParent = new Map<string, Product[]>();
  const orphans: Product[] = [];

  products.forEach((p) => {
    if (p.is_parent) {
      parentsMap.set(p.id, { ...p, children: [] });
    } else if (p.parent_id) {
      const arr = childrenByParent.get(p.parent_id) ?? [];
      arr.push(p);
      childrenByParent.set(p.parent_id, arr);
    } else {
      orphans.push(p);
    }
  });

  parentsMap.forEach((parent) => {
    const kids = childrenByParent.get(parent.id) ?? [];
    parent.children = kids.sort((a, b) => a.name.localeCompare(b.name));
  });

  return {
    ...q,
    parents: Array.from(parentsMap.values()),
    orphans,
  };
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductInput) => {
      const { data, error } = await supabase.from("products").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProductInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("products")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/** Elimina un padre + todas sus variantes hijas y su BOM. */
export function useDeleteProductTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parentId: string) => {
      // recoger ids hijos
      const { data: kids, error: e1 } = await supabase
        .from("products")
        .select("id")
        .eq("parent_id", parentId);
      if (e1) throw e1;
      const allIds = [parentId, ...(kids ?? []).map((k) => k.id)];
      // borrar BOM asociado
      const { error: e2 } = await supabase
        .from("product_materials")
        .delete()
        .in("product_id", allIds);
      if (e2) throw e2;
      // borrar productos
      const { error: e3 } = await supabase.from("products").delete().in("id", allIds);
      if (e3) throw e3;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export interface VariantInput {
  sku: string;
  name: string;
  base_color: string | null;
  size: string | null;
  print_design: string | null;
  print_color: string | null;
  print_height_cm: number;
  raw_material_id: string;
  stock: number;
  safety_stock: number;
  aging_days: number;
  price: number;
  cost: number;
}

/** Crea un producto padre y todas sus variantes hijas con sus BOM en bloque. */
export function useCreateProductWithVariants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      parent,
      variants,
    }: {
      parent: ProductInput;
      variants: VariantInput[];
    }) => {
      // 1) Crear padre
      const { data: created, error: e1 } = await supabase
        .from("products")
        .insert({ ...parent, is_parent: true, stock: 0, safety_stock: 0 })
        .select()
        .single();
      if (e1) throw e1;
      const parentId = (created as Product).id;

      if (variants.length === 0) return created;

      // 2) Insertar hijas
      const childRows = variants.map((v) => ({
        sku: v.sku,
        name: v.name,
        description: parent.description ?? null,
        product_url: parent.product_url ?? null,
        active: parent.active,
        base_color: v.base_color,
        size: v.size,
        print_color: v.print_color,
        print_design: v.print_design,
        print_height_cm: v.print_height_cm,
        stock: v.stock,
        safety_stock: v.safety_stock,
        aging_days: v.aging_days,
        price: v.price,
        cost: v.cost,
        parent_id: parentId,
        is_parent: false,
      }));

      const { data: insertedChildren, error: e2 } = await supabase
        .from("products")
        .insert(childRows)
        .select();
      if (e2) throw e2;

      // 3) BOM por cada hija → su raw_material_id
      const bomRows = (insertedChildren ?? []).map((child, idx) => ({
        product_id: (child as Product).id,
        raw_material_id: variants[idx].raw_material_id,
        quantity_required: 1,
      }));
      if (bomRows.length > 0) {
        const { error: e3 } = await supabase.from("product_materials").insert(bomRows);
        if (e3) throw e3;
      }

      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
