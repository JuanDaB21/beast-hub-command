import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type GlobalConfigId = "printing_cost_per_meter" | "ironing_cost";

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
