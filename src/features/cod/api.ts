import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CodOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  is_cod: boolean;
  cod_confirmed: boolean;
  total: number;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  cod_received_at: string | null;
  received_by_staff_id: string | null;
  created_at: string;
}

const QK_COD = ["cod-orders"] as const;

export function useCodOrders() {
  return useQuery({
    queryKey: QK_COD,
    queryFn: async (): Promise<CodOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_phone, status, is_cod, cod_confirmed, total, carrier, tracking_number, shipped_at, cod_received_at, received_by_staff_id, created_at"
        )
        .eq("is_cod", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CodOrder[];
    },
  });
}

export function useConfirmCodReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const staffId = userData?.user?.id ?? null;
      const { error } = await supabase
        .from("orders")
        .update({
          cod_confirmed: true,
          cod_received_at: new Date().toISOString(),
          received_by_staff_id: staffId,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_COD }),
  });
}
