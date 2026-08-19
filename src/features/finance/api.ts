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
  occurred_at: string;
  payment_method: string | null;
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
  occurred_at?: string | null;
  payment_method?: string | null;
}

/** Canales de pago para etiquetar ingresos y conciliar contra las órdenes. */
export const PAYMENT_CHANNELS: { value: string; label: string }[] = [
  { value: "bancolombia", label: "Bancolombia" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "fisico", label: "Físico" },
  { value: "cod", label: "COD (contra entrega)" },
];

export const PAYMENT_CHANNEL_LABEL: Record<string, string> = {
  ...Object.fromEntries(PAYMENT_CHANNELS.map((c) => [c.value, c.label])),
  sin_asignar: "Sin asignar",
};

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
  occurred_at?: string | null;
  payment_method?: string | null;
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
        if (input.occurred_at !== undefined) body.occurred_at = input.occurred_at;
        if (input.payment_method !== undefined) body.payment_method = input.payment_method ?? null;
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

export interface ReconciliationRow {
  method: string;
  sales: number;
  income: number;
  diff: number;
}

export interface Reconciliation {
  month: string;
  by_method: ReconciliationRow[];
  sales_total: number;
  income_total: number;
  expenses_total: number;
  net: number;
}

/** month en formato YYYY-MM. */
export function useReconciliation(month: string) {
  return useQuery({
    queryKey: ["finance_reconciliation", month],
    queryFn: () => api.get<Reconciliation>("/finance/reconciliation", { month }),
    enabled: !!month,
  });
}
