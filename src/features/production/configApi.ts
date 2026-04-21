import { supabase } from "@/integrations/supabase/client";
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

export interface GlobalConfigRow {
  id: string;
  value: number;
  updated_at: string;
}

const QK = ["global_configs"] as const;

export function useGlobalConfigs() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => Promise<{ data: GlobalConfigRow[] | null; error: { message: string } | null }>;
        };
      })
        .from("global_configs")
        .select("id, value, updated_at");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        map[r.id] = Number(r.value);
      });
      return map;
    },
  });
}

export function useUpdateGlobalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: GlobalConfigId; value: number }) => {
      const { error } = await (supabase as unknown as {
        from: (t: string) => {
          upsert: (
            v: Record<string, unknown>,
            o: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("global_configs")
        .upsert({ id, value, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/** Suma de orders.total del mes corriente, excluyendo cancelados. */
export function useGrossRevenueCurrentMonth() {
  return useQuery({
    queryKey: ["gross-revenue-current-month"],
    queryFn: async (): Promise<number> => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("total")
        .neq("status", "cancelled")
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;
      return (data ?? []).reduce((acc, r: { total: number | string }) => acc + Number(r.total ?? 0), 0);
    },
  });
}
