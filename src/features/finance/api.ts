import { api } from "@/integrations/api/client";
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
  charged_to_staff_id: string | null;
  charged_to: { id: string; full_name: string | null } | null;
}

export interface FinancialTransactionInput {
  transaction_type: FinancialTransactionType;
  amount: number;
  category: string;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  charged_to_staff_id?: string | null;
}

export interface FinanceFilters {
  type?: FinancialTransactionType | "all";
  category?: string | "all";
  from?: string | null;
  to?: string | null;
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
    queryFn: () =>
      api.get<FinancialTransaction[]>("/finance", {
        type: filters.type && filters.type !== "all" ? filters.type : undefined,
        category: filters.category && filters.category !== "all" ? filters.category : undefined,
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        search: filters.search?.trim() || undefined,
      }),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinancialTransactionInput) => api.post<FinancialTransaction>("/finance", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_transactions"] });
      qc.invalidateQueries({ queryKey: ["bi"] });
    },
  });
}

export interface UpdateTransactionInput {
  id: string;
  reference_type: string | null;
  amount?: number;
  category?: string;
  description?: string | null;
  charged_to_staff_id?: string | null;
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => {
      const isManual = !input.reference_type || input.reference_type === "manual";
      const body: Record<string, unknown> = {};
      if (isManual) {
        if (input.amount !== undefined) body.amount = input.amount;
        if (input.category !== undefined) body.category = input.category;
        if (input.description !== undefined) body.description = input.description ?? null;
      }
      if (input.charged_to_staff_id !== undefined) {
        body.charged_to_staff_id = input.charged_to_staff_id ?? null;
      }
      return api.patch<FinancialTransaction>(`/finance/${input.id}`, body);
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
    mutationFn: (tx: FinancialTransaction) => api.delete<{ ok: true }>(`/finance/${tx.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_transactions"] });
      qc.invalidateQueries({ queryKey: ["bi"] });
    },
  });
}

export async function insertTransaction(input: FinancialTransactionInput) {
  await api.post<FinancialTransaction>("/finance", input);
}
