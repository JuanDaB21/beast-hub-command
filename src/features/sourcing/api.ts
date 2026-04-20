import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Catalogs                                                           */
/* ------------------------------------------------------------------ */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Category> => {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: name.trim() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useCreateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category_id: string }): Promise<Subcategory> => {
      const { data, error } = await supabase
        .from("subcategories")
        .insert({ name: input.name.trim(), category_id: input.category_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["subcategories", vars.category_id] });
      qc.invalidateQueries({ queryKey: ["subcategories", "all"] });
    },
  });
}

export function useSubcategories(categoryId?: string | null) {
  return useQuery({
    queryKey: ["subcategories", categoryId ?? "all"],
    queryFn: async (): Promise<Subcategory[]> => {
      let q = supabase.from("subcategories").select("*").order("name");
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useColors() {
  return useQuery({
    queryKey: ["colors"],
    queryFn: async (): Promise<Color[]> => {
      const { data, error } = await supabase.from("colors").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSizes() {
  return useQuery({
    queryKey: ["sizes"],
    queryFn: async (): Promise<Size[]> => {
      const { data, error } = await supabase.from("sizes").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Suppliers                                                          */
/* ------------------------------------------------------------------ */
export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
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
    mutationFn: async (input: SupplierInput) => {
      const { data, error } = await supabase.from("suppliers").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

/* ------------------------------------------------------------------ */
/*  Raw materials                                                      */
/* ------------------------------------------------------------------ */
const RM_SELECT = `
  *,
  supplier:suppliers ( id, name, contact_phone ),
  category:categories ( id, name ),
  subcategory:subcategories ( id, category_id, name ),
  color:colors ( id, name, hex_code ),
  size:sizes ( id, label, sort_order )
`;

export function useRawMaterials() {
  return useQuery({
    queryKey: ["raw_materials"],
    queryFn: async (): Promise<RawMaterialWithRelations[]> => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select(RM_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RawMaterialWithRelations[];
    },
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
    mutationFn: async (input: RawMaterialInput) => {
      const { data, error } = await supabase.from("raw_materials").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export async function findExistingVariantNames(
  supplierId: string,
  categoryId: string,
  names: string[],
): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const { data, error } = await supabase
    .from("raw_materials")
    .select("name")
    .eq("supplier_id", supplierId)
    .eq("category_id", categoryId)
    .in("name", names);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.name));
}

export function useCreateRawMaterialsBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: RawMaterialInput[]) => {
      if (inputs.length === 0) throw new Error("No variants to create");
      const { data, error } = await supabase.from("raw_materials").insert(inputs).select();
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export type RawMaterialUpdate = Partial<RawMaterialInput>;

export function useUpdateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: RawMaterialUpdate }) => {
      const { data, error } = await supabase
        .from("raw_materials")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export function useDeleteRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("raw_materials").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}
