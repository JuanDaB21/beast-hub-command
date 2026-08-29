import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProductionProcess {
  id: string;
  name: string;
  cost: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionProcessInput {
  name: string;
  cost: number;
  active?: boolean;
}

export interface ProductProcessLink {
  id: string;
  product_id: string;
  process_id: string;
  process: { id: string; name: string; cost: number; active: boolean };
}

const QK = ["production-processes"] as const;

export function useProductionProcesses(params?: { active?: boolean }) {
  return useQuery({
    queryKey: [...QK, params],
    queryFn: () => {
      const query: Record<string, unknown> = {};
      if (params?.active !== undefined) query.active = String(params.active);
      return api.get<ProductionProcess[]>(
        "/production-processes",
        Object.keys(query).length ? query : undefined,
      );
    },
  });
}

export function useCreateProductionProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductionProcessInput) =>
      api.post<ProductionProcess>("/production-processes", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateProductionProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ProductionProcessInput> & { id: string }) =>
      api.patch<ProductionProcess>(`/production-processes/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteProductionProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/production-processes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/** Procesos asignados a un conjunto de productos. */
export function useProductProcessesBatch(productIds: string[]) {
  const key = [...productIds].sort().join(",");
  return useQuery({
    queryKey: ["product-processes", key],
    enabled: productIds.length > 0,
    queryFn: () =>
      api.get<ProductProcessLink[]>("/production-processes/by-products", {
        product_ids: productIds.join(","),
      }),
  });
}

/** Reemplaza el set de procesos de un producto. */
export function useSetProductProcesses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, processIds }: { productId: string; processIds: string[] }) =>
      api.put(`/production-processes/product/${productId}`, { process_ids: processIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-processes"] }),
  });
}
