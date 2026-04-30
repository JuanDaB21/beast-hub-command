import { api } from "@/integrations/api/client";
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
  print_design_id: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  base_group_key: string | null;
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
    queryFn: () => api.get<Product[]>("/products"),
  });
}

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
    mutationFn: (input: ProductInput) => api.post<Product>("/products", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ProductInput> & { id: string }) =>
      api.patch<Product>(`/products/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/** Elimina un padre + todas sus variantes hijas y su BOM. */
export function useDeleteProductTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parentId: string) => {
      const kids = await api.get<Product[]>("/products", { parent_id: parentId });
      const allIds = [parentId, ...kids.map((k) => k.id)];
      await api.delete<{ deleted: number }>("/product-materials", { body: { product_ids: allIds } });
      await api.delete<{ deleted: number }>("/products", { body: { ids: allIds } });
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
  print_design_id: string | null;
  print_color: string | null;
  print_height_cm: number;
  raw_material_id: string;
  ink_raw_material_id: string | null;
  ink_quantity_required: number;
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
      const created = await api.post<Product>("/products", {
        ...parent,
        is_parent: true,
        stock: 0,
        safety_stock: 0,
      });
      if (variants.length === 0) return created;

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
        print_design_id: v.print_design_id,
        print_height_cm: v.print_height_cm,
        stock: v.stock,
        safety_stock: v.safety_stock,
        aging_days: v.aging_days,
        price: v.price,
        cost: v.cost,
        parent_id: created.id,
        is_parent: false,
      }));

      const insertedChildren = await api.post<Product[]>("/products", childRows);

      const bomRows = insertedChildren.flatMap((child, idx) => {
        const v = variants[idx];
        const rows: Array<{ product_id: string; raw_material_id: string; quantity_required: number }> = [
          { product_id: child.id, raw_material_id: v.raw_material_id, quantity_required: 1 },
        ];
        if (v.ink_raw_material_id && v.ink_quantity_required > 0) {
          rows.push({
            product_id: child.id,
            raw_material_id: v.ink_raw_material_id,
            quantity_required: v.ink_quantity_required,
          });
        }
        return rows;
      });
      if (bomRows.length > 0) {
        await api.post("/product-materials", bomRows);
      }

      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/** Agrega variantes nuevas a un padre existente sin tocar las viejas. */
export function useAddVariantsToParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      parentId,
      parentDescription,
      parentUrl,
      parentActive,
      variants,
    }: {
      parentId: string;
      parentDescription: string | null;
      parentUrl: string | null;
      parentActive: boolean;
      variants: VariantInput[];
    }) => {
      if (variants.length === 0) return [] as Product[];

      const childRows = variants.map((v) => ({
        sku: v.sku,
        name: v.name,
        description: parentDescription,
        product_url: parentUrl,
        active: parentActive,
        base_color: v.base_color,
        size: v.size,
        print_color: v.print_color,
        print_design: v.print_design,
        print_design_id: v.print_design_id,
        print_height_cm: v.print_height_cm,
        stock: v.stock,
        safety_stock: v.safety_stock,
        aging_days: v.aging_days,
        price: v.price,
        cost: v.cost,
        parent_id: parentId,
        is_parent: false,
      }));

      const insertedChildren = await api.post<Product[]>("/products", childRows);

      const bomRows = insertedChildren.flatMap((child, idx) => {
        const v = variants[idx];
        const rows: Array<{ product_id: string; raw_material_id: string; quantity_required: number }> = [
          { product_id: child.id, raw_material_id: v.raw_material_id, quantity_required: 1 },
        ];
        if (v.ink_raw_material_id && v.ink_quantity_required > 0) {
          rows.push({
            product_id: child.id,
            raw_material_id: v.ink_raw_material_id,
            quantity_required: v.ink_quantity_required,
          });
        }
        return rows;
      });
      if (bomRows.length > 0) {
        await api.post("/product-materials", bomRows);
      }

      return insertedChildren;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
