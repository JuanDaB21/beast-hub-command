import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type FinancialTransactionType = "income" | "expense";

export interface FinancialTransaction {
  id: string;
  transaction_type: FinancialTransactionType;
  amount: number;
  category: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface FinancialTransactionInput {
  transaction_type: FinancialTransactionType;
  amount: number;
  category: string;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
}

export interface FinanceFilters {
  type?: FinancialTransactionType | "all";
  category?: string | "all";
  from?: string | null; // ISO
  to?: string | null; // ISO
  search?: string;
}

export const INCOME_CATEGORIES = [
  "Pago Shopify",
  "Pago COD",
  "Ingreso manual",
  "Reembolso recibido",
  "Otro",
];

export const EXPENSE_CATEGORIES = [
  "Pago a proveedor",
  "Nómina",
  "Servicios",
  "Logística",
  "Marketing",
  "Pérdida por Merma",
  "Logística RMA",
  "Otro",
];

export function useFinancialTransactions(filters: FinanceFilters = {}) {
  return useQuery({
    queryKey: ["financial_transactions", filters],
    queryFn: async () => {
      let q = supabase
        .from("financial_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.type && filters.type !== "all") {
        q = q.eq("transaction_type", filters.type);
      }
      if (filters.category && filters.category !== "all") {
        q = q.eq("category", filters.category);
      }
      if (filters.from) q = q.gte("created_at", filters.from);
      if (filters.to) q = q.lte("created_at", filters.to);
      if (filters.search && filters.search.trim()) {
        q = q.ilike("description", `%${filters.search.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FinancialTransaction[];
    },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinancialTransactionInput) => {
      const { error } = await supabase.from("financial_transactions").insert({
        transaction_type: input.transaction_type,
        amount: input.amount,
        category: input.category,
        reference_type: input.reference_type ?? "manual",
        reference_id: input.reference_id ?? null,
        description: input.description ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_transactions"] });
      qc.invalidateQueries({ queryKey: ["bi"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: FinancialTransaction) => {
      if (tx.reference_type && tx.reference_type !== "manual") {
        throw new Error(
          "Solo se pueden eliminar transacciones manuales. Las automáticas se gestionan desde su módulo de origen.",
        );
      }
      const { error } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_transactions"] });
      qc.invalidateQueries({ queryKey: ["bi"] });
    },
  });
}

export async function insertTransaction(input: FinancialTransactionInput) {
  const { error } = await supabase.from("financial_transactions").insert({
    transaction_type: input.transaction_type,
    amount: input.amount,
    category: input.category,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    description: input.description ?? null,
  });
  if (error) throw error;
}
