import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type GlobalConfigId =
  | "printing_cost_per_meter"
  | "ironing_cost"
  | "shopify_fee_percent"
  | "gateway_fee_percent"
  | "gateway_fee_fixed"
  | "cod_transport_fee_percent"
  | "estimated_iva_percent"
  | "estimated_retention_percent";

const QK = ["global_configs"] as const;

export function useGlobalConfigs() {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.get<Record<string, number>>("/config"),
  });
}

export function useUpdateGlobalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: GlobalConfigId; value: number }) =>
      api.patch(`/config/${id}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/** Suma de orders.total del mes corriente, excluyendo cancelados. */
export function useGrossRevenueCurrentMonth() {
  return useQuery({
    queryKey: ["gross-revenue-current-month"],
    queryFn: async (): Promise<number> => {
      const res = await api.get<{ total: number }>("/config/gross-revenue-current-month");
      return Number(res.total ?? 0);
    },
  });
}
