import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ReturnStatus = "pending" | "restocked" | "scrapped";
export type ReturnReason = "Textil" | "Estampado" | "Logística" | "Inconformidad";

export const RETURN_REASONS: ReturnReason[] = ["Textil", "Estampado", "Logística", "Inconformidad"];

export interface ReturnRow {
  id: string;
  order_id: string | null;
  product_id: string | null;
  reason_category: ReturnReason;
  notes: string | null;
  resolution_status: ReturnStatus;
  resolved_at: string | null;
  company_assumes_shipping: boolean;
  return_shipping_cost: number;
  created_at: string;
  updated_at: string;
  order: { id: string; order_number: string; customer_name: string } | null;
  product: { id: string; sku: string; name: string; stock: number; cost: number } | null;
}

const QK = ["returns"] as const;

export function useReturns() {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.get<ReturnRow[]>("/returns"),
  });
}

/** Pedidos disponibles para devolución (no cancelados). */
export function useOrdersForReturns() {
  return useQuery({
    queryKey: ["orders-for-returns"],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          order_number: string;
          customer_name: string;
          status: string;
          items: Array<{
            id: string;
            product_id: string | null;
            quantity: number;
            product: { id: string; sku: string; name: string } | null;
          }>;
        }>
      >("/orders", { not_status: "cancelled", limit: 500 }),
  });
}

export interface NewReturnInput {
  order_id: string;
  product_id: string;
  reason_category: ReturnReason;
  notes?: string;
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReturnInput) =>
      api.post<ReturnRow>("/returns", {
        order_id: input.order_id,
        product_id: input.product_id,
        reason_category: input.reason_category,
        notes: input.notes ?? null,
        resolution_status: "pending",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export interface ResolveInput {
  id: string;
  product_id: string | null;
  current_stock: number | null;
  resolution: "restocked" | "scrapped";
  notes: string;
  company_assumes_shipping: boolean;
  return_shipping_cost: number;
  product_cost: number;
  order_number?: string | null;
  product_name?: string | null;
}

/** Resuelve la devolución transaccionalmente en el backend. */
export function useResolveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveInput) =>
      api.post(`/returns/${input.id}/resolve`, {
        resolution: input.resolution,
        notes: input.notes,
        company_assumes_shipping: input.company_assumes_shipping,
        return_shipping_cost: input.return_shipping_cost,
        product_id: input.product_id,
        current_stock: input.current_stock,
        product_cost: input.product_cost,
        order_number: input.order_number,
        product_name: input.product_name,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["financial_transactions"] });
      qc.invalidateQueries({ queryKey: ["bi"] });
    },
  });
}

export function useDeleteReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/returns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
