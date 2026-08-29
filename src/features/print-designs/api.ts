import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";

export interface PrintDesign {
  id: string;
  name: string;
  hex_code: string;
  ink_raw_material_id: string | null;
  ink_grams_per_cm: number;
  active: boolean;
  drive_url: string | null;
  parent_design_id: string | null;
  created_at: string;
  updated_at: string;
  ink_raw_material: {
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    unit_of_measure: string;
    unit_price: number;
  } | null;
}

export interface PrintDesignWithChildren extends PrintDesign {
  children: PrintDesign[];
}

export interface PrintDesignInput {
  name: string;
  hex_code: string;
  ink_raw_material_id?: string | null;
  ink_grams_per_cm?: number;
  active?: boolean;
  drive_url?: string | null;
  parent_design_id?: string | null;
}

const QK = ["print-designs"] as const;

export function usePrintDesigns(params?: { active?: boolean }) {
  return useQuery({
    queryKey: [...QK, params],
    queryFn: () => {
      const query: Record<string, unknown> = {};
      if (params?.active !== undefined) query.active = String(params.active);
      return api.get<PrintDesign[]>("/print-designs", Object.keys(query).length ? query : undefined);
    },
  });
}

/**
 * Agrupa los estampados en árbol padre → hijos por color. Un estampado sin
 * parent_design_id es raíz; los que lo referencian son sus hijos de color.
 */
export function usePrintDesignTree(params?: { active?: boolean }) {
  const q = usePrintDesigns(params);
  const designs = q.data ?? [];
  const childrenByParent = new Map<string, PrintDesign[]>();
  const roots: PrintDesignWithChildren[] = [];

  designs.forEach((d) => {
    if (d.parent_design_id) {
      const arr = childrenByParent.get(d.parent_design_id) ?? [];
      arr.push(d);
      childrenByParent.set(d.parent_design_id, arr);
    }
  });
  designs.forEach((d) => {
    if (!d.parent_design_id) {
      roots.push({ ...d, children: (childrenByParent.get(d.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)) });
    }
  });
  roots.sort((a, b) => a.name.localeCompare(b.name));

  return { ...q, roots };
}

export function useCreatePrintDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PrintDesignInput) =>
      api.post<PrintDesign>("/print-designs", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdatePrintDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: PrintDesignInput & { id: string }) =>
      api.patch<PrintDesign>(`/print-designs/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeletePrintDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/print-designs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
