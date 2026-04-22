import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CodOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  source: "shopify" | "manual";
  is_cod: boolean;
  order_confirmed: boolean;
  order_confirmed_at: string | null;
  confirmed_by_staff_id: string | null;
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
    queryFn: () => api.get<CodOrder[]>("/cod/orders"),
  });
}

export function useConfirmCodOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<CodOrder>(`/cod/orders/${id}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_COD }),
  });
}

export function useConfirmCodReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<CodOrder>(`/cod/orders/${id}/receipt`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_COD }),
  });
}
