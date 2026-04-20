import { supabase } from "@/integrations/supabase/client";
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
  created_at: string;
  updated_at: string;
  order: { id: string; order_number: string; customer_name: string } | null;
  product: { id: string; sku: string; name: string; stock: number } | null;
}

const QK = ["returns"] as const;

export function useReturns() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<ReturnRow[]> => {
      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          order:orders ( id, order_number, customer_name ),
          product:products ( id, sku, name, stock )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReturnRow[];
    },
  });
}

/** Pedidos disponibles para devolución (no cancelados). */
export function useOrdersForReturns() {
  return useQuery({
    queryKey: ["orders-for-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, order_number, customer_name, status,
          items:order_items ( id, product_id, quantity,
            product:products ( id, sku, name )
          )
        `)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
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
    mutationFn: async (input: NewReturnInput) => {
      const { error } = await supabase.from("returns").insert({
        order_id: input.order_id,
        product_id: input.product_id,
        reason_category: input.reason_category,
        notes: input.notes ?? null,
        resolution_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export interface ResolveInput {
  id: string;
  product_id: string | null;
  current_stock: number | null;
  resolution: "restocked" | "scrapped";
  notes: string;
}

/** Resuelve la devolución. Si es 'restocked', suma +1 al stock del producto. */
export function useResolveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, product_id, current_stock, resolution, notes }: ResolveInput) => {
      const { error: updErr } = await supabase
        .from("returns")
        .update({
          resolution_status: resolution,
          notes,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (updErr) throw updErr;

      if (resolution === "restocked" && product_id) {
        const newStock = (current_stock ?? 0) + 1;
        const { error: stockErr } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", product_id);
        if (stockErr) throw stockErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("returns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
