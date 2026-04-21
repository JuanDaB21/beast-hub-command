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
    queryFn: async (): Promise<ReturnRow[]> => {
      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          order:orders ( id, order_number, customer_name ),
          product:products ( id, sku, name, stock, cost )
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
  company_assumes_shipping: boolean;
  return_shipping_cost: number;
  product_cost: number;
  order_number?: string | null;
  product_name?: string | null;
}

/** Resuelve la devolución. Si es 'restocked', suma +1 al stock. Si es 'scrapped', registra merma en el libro mayor. Si la empresa asume el envío, registra ese gasto. */
export function useResolveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      product_id,
      current_stock,
      resolution,
      notes,
      company_assumes_shipping,
      return_shipping_cost,
      product_cost,
      order_number,
      product_name,
    }: ResolveInput) => {
      const { error: updErr } = await supabase
        .from("returns")
        .update({
          resolution_status: resolution,
          notes,
          resolved_at: new Date().toISOString(),
          company_assumes_shipping,
          return_shipping_cost,
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

      // Libro mayor: merma
      if (resolution === "scrapped" && product_cost > 0) {
        const { error: txErr } = await supabase.from("financial_transactions").insert({
          transaction_type: "expense",
          amount: product_cost,
          category: "Pérdida por Merma",
          reference_type: "return",
          reference_id: id,
          description: `Merma ${product_name ?? "producto"} · pedido ${order_number ?? "—"}`,
        });
        if (txErr) throw txErr;
      }

      // Libro mayor: flete asumido
      if (company_assumes_shipping && return_shipping_cost > 0) {
        const { error: txErr } = await supabase.from("financial_transactions").insert({
          transaction_type: "expense",
          amount: return_shipping_cost,
          category: "Logística RMA",
          reference_type: "return",
          reference_id: id,
          description: `Flete devolución pedido ${order_number ?? "—"}`,
        });
        if (txErr) throw txErr;
      }
    },
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("returns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
