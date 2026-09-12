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
  source: string | null;
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
  source?: string | null;
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

/** Canal/origen de venta para conciliar ingresos contra las ventas de las órdenes. */
export const SALES_SOURCES: { value: string; label: string }[] = [
  { value: "shopify", label: "Shopify" },
  { value: "manual", label: "Manual" },
];

export const SALES_SOURCE_LABEL: Record<string, string> = {
  ...Object.fromEntries(SALES_SOURCES.map((s) => [s.value, s.label])),
  sin_asignar: "Sin asignar",
};

export interface FinanceFilters {
  type?: FinancialTransactionType | "all";
  category?: string | "all";
  /** Id del responsable, "none" para los sin asignar, "all" para no filtrar. */
  charged_to?: string | "all" | "none";
  /** Vía de cobro; "none" para los ingresos sin asignar. */
  payment_method?: string | "all" | "none";
  /** Canal de venta; "none" para los que no se asignaron a ninguno. */
  source?: string | "all" | "none";
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

/**
 * 'Logística — Envío a cliente' la genera el servidor al capturar el costo del
 * flete en el ShipDialog; se lista aquí solo para que el filtro por categoría la
 * ofrezca. No hay que teclearla a mano, y 'Logística RMA' vuelve a significar
 * solo fletes de devolución.
 */
export const SHIPPING_EXPENSE_CATEGORY = "Logística — Envío a cliente";

export const EXPENSE_CATEGORIES = [
  "Pago a proveedor",
  "Nómina",
  "Servicios",
  "Logística",
  SHIPPING_EXPENSE_CATEGORY,
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
        charged_to:
          filters.charged_to && filters.charged_to !== "all" ? filters.charged_to : undefined,
        payment_method:
          filters.payment_method && filters.payment_method !== "all"
            ? filters.payment_method
            : undefined,
        source: filters.source && filters.source !== "all" ? filters.source : undefined,
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
      qc.invalidateQueries({ queryKey: ["finance_reconciliation"] });
      qc.invalidateQueries({ queryKey: ["finance_trend"] });
      qc.invalidateQueries({ queryKey: ["finance_summary"] });
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
  source?: string | null;
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
        if (input.source !== undefined) body.source = input.source ?? null;
      }
      if (input.charged_to_staff_id !== undefined) {
        body.charged_to_staff_id = input.charged_to_staff_id ?? null;
      }
      return api.patch<FinancialTransaction>(`/finance/${input.id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_transactions"] });
      qc.invalidateQueries({ queryKey: ["finance_reconciliation"] });
      qc.invalidateQueries({ queryKey: ["finance_trend"] });
      qc.invalidateQueries({ queryKey: ["finance_summary"] });
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
      qc.invalidateQueries({ queryKey: ["finance_reconciliation"] });
      qc.invalidateQueries({ queryKey: ["finance_trend"] });
      qc.invalidateQueries({ queryKey: ["finance_summary"] });
      qc.invalidateQueries({ queryKey: ["bi"] });
    },
  });
}

export async function insertTransaction(input: FinancialTransactionInput) {
  await api.post<FinancialTransaction>("/finance", input);
}

export interface ReconciliationRow {
  source: string;
  sales: number;
  income: number;
  diff: number;
}

export interface ExpenseCategoryRow {
  category: string;
  amount: number;
}

/**
 * Conciliación por vía de cobro. A diferencia de by_source (ventas facturadas),
 * `collected` es plata YA COBRADA: COD entregados y prepagos verificados. El
 * `diff` de la fila 'cod' es lo que la transportadora aún no ha girado.
 */
export interface PaymentChannelRow {
  channel: string;
  collected: number;
  income: number;
  diff: number;
}

export interface ShippingSummary {
  /** Lo que el cliente pagó por envío (líneas kind='fee'). */
  charged: number;
  /** El flete real pagado a la transportadora (orders.shipping_cost). */
  paid: number;
  net: number;
  /** Despachados con shipping_cost=0: inflan el margen hasta capturarlo. */
  missing_cost_orders: number;
}

export interface Reconciliation {
  month: string;
  by_source: ReconciliationRow[];
  by_payment_method: PaymentChannelRow[];
  shipping: ShippingSummary;
  expenses_by_category: ExpenseCategoryRow[];
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

export interface FinanceSummary {
  sales_total: number;
  income_total: number;
  expenses_total: number;
}

/** Totales acumulados de todo el tiempo (independiente del mes). */
export function useFinanceSummary() {
  return useQuery({
    queryKey: ["finance_summary"],
    queryFn: () => api.get<FinanceSummary>("/finance/summary"),
    staleTime: 60_000,
  });
}

export interface TrendPoint {
  month: string;
  sales: number;
  income: number;
  expenses: number;
}

/** Serie histórica de los últimos `months` meses terminando en `month` (YYYY-MM). */
export function useFinanceTrend(month: string, months = 6) {
  return useQuery({
    queryKey: ["finance_trend", month, months],
    queryFn: () =>
      api.get<TrendPoint[]>("/finance/trend", { month, months: String(months) }),
    enabled: !!month,
  });
}
