import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";

export interface PrintDesign {
  id: string;
  name: string;
  hex_code: string;
  ink_raw_material_id: string | null;
  ink_grams_per_cm: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  ink_raw_material: {
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    unit_of_measure: string;
  } | null;
}

export interface PrintDesignInput {
  name: string;
  hex_code: string;
  ink_raw_material_id?: string | null;
  ink_grams_per_cm?: number;
  active?: boolean;
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
