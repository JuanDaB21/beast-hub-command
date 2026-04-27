import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Supplier {
  id: string;
  name: string;
  contact_phone: string;
  contact_email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

export interface Color {
  id: string;
  name: string;
  hex_code: string | null;
}

export interface Size {
  id: string;
  label: string;
  sort_order: number;
}

export interface RawMaterial {
  id: string;
  supplier_id: string;
  category_id: string;
  subcategory_id: string | null;
  color_id: string | null;
  size_id: string | null;
  sku: string | null;
  name: string;
  unit_price: number;
  unit_of_measure: string;
  stock: number;
  created_at: string;
  updated_at: string;
}

export interface RawMaterialWithRelations extends RawMaterial {
  supplier: Pick<Supplier, "id" | "name" | "contact_phone"> | null;
  category: Category | null;
  subcategory: Subcategory | null;
  color: Color | null;
  size: Size | null;
}

/* ---- Catalogs ---- */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/catalogs/categories"),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<Category>("/catalogs/categories", { name: name.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useCreateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; category_id: string }) =>
      api.post<Subcategory>("/catalogs/subcategories", {
        name: input.name.trim(),
        category_id: input.category_id,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["subcategories", vars.category_id] });
      qc.invalidateQueries({ queryKey: ["subcategories", "all"] });
    },
  });
}

export function useSubcategories(categoryId?: string | null) {
  return useQuery({
    queryKey: ["subcategories", categoryId ?? "all"],
    queryFn: () =>
      api.get<Subcategory[]>(
        "/catalogs/subcategories",
        categoryId ? { category_id: categoryId } : undefined,
      ),
  });
}

export function useColors() {
  return useQuery({
    queryKey: ["colors"],
    queryFn: () => api.get<Color[]>("/catalogs/colors"),
  });
}

export function useCreateColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; hex_code: string | null }) =>
      api.post<Color>("/catalogs/colors", {
        name: input.name.trim(),
        hex_code: input.hex_code,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colors"] }),
  });
}

export function useSizes() {
  return useQuery({
    queryKey: ["sizes"],
    queryFn: () => api.get<Size[]>("/catalogs/sizes"),
  });
}

/* ---- Suppliers ---- */
export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/suppliers"),
  });
}

export interface SupplierInput {
  name: string;
  contact_phone: string;
  contact_email?: string | null;
  address?: string | null;
  notes?: string | null;
  active?: boolean;
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierInput) => api.post<Supplier>("/suppliers", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

/* ---- Raw materials ---- */
export function useRawMaterials() {
  return useQuery({
    queryKey: ["raw_materials"],
    queryFn: () => api.get<RawMaterialWithRelations[]>("/raw-materials"),
  });
}

export interface RawMaterialInput {
  supplier_id: string;
  category_id: string;
  subcategory_id?: string | null;
  color_id?: string | null;
  size_id?: string | null;
  sku?: string | null;
  name: string;
  unit_price: number;
  unit_of_measure: string;
  stock?: number;
}

export function useCreateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RawMaterialInput) => api.post<RawMaterial>("/raw-materials", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export async function findExistingVariantNames(
  supplierId: string,
  categoryId: string,
  names: string[],
): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const rows = await api.get<Array<{ name: string }>>("/raw-materials", {
    supplier_id: supplierId,
    category_id: categoryId,
    names,
  });
  return new Set(rows.map((r) => r.name));
}

export function useCreateRawMaterialsBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs: RawMaterialInput[]) => {
      if (inputs.length === 0) throw new Error("No variants to create");
      return api.post<RawMaterial[]>("/raw-materials", inputs);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export type RawMaterialUpdate = Partial<RawMaterialInput>;

export function useUpdateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RawMaterialUpdate }) =>
      api.patch<RawMaterial>(`/raw-materials/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export function useDeleteRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/raw-materials/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export interface UpdateGroupInput {
  ids: string[];
  oldBaseName: string;
  newBaseName?: string;
  shared: {
    supplier_id?: string;
    category_id?: string;
    subcategory_id?: string | null;
    unit_price?: number;
    unit_of_measure?: string;
  };
  suffixById?: Record<string, string>;
}

export function useUpdateRawMaterialsGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateGroupInput) => {
      const { ids, newBaseName, shared, suffixById } = input;
      if (newBaseName !== undefined) {
        for (const id of ids) {
          const suffix = suffixById?.[id] ?? "";
          const newName = [newBaseName, suffix].filter(Boolean).join(" - ");
          await api.patch(`/raw-materials/${id}`, { ...shared, name: newName });
        }
      } else {
        await api.patch("/raw-materials", { ids, patch: shared });
      }
      return ids;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export function useDeleteRawMaterialsGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return [];
      await api.delete("/raw-materials", { body: { ids } });
      return ids;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}
