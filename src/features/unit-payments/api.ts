import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface UnitPaymentRun {
  id: string;
  period_from: string;
  period_to: string;
  units: number;
  rate_per_unit: number;
  total_amount: number;
  notes: string | null;
  financial_transaction_id: string | null;
  created_at: string;
  created_by: { id: string; full_name: string | null } | null;
}

export interface UnitsInPeriod {
  units: number;
  overlapping_runs: {
    id: string;
    period_from: string;
    period_to: string;
    units: number;
    rate_per_unit: number;
    total_amount: number;
  }[];
}

const QK = ["unit_payment_runs"] as const;

/** Prendas entregadas en el rango, más los pagos ya generados que lo cruzan. */
export function useUnitsInPeriod(from: Date | undefined, to: Date | undefined) {
  return useQuery({
    queryKey: ["unit_payment_units", from?.toISOString(), to?.toISOString()],
    enabled: !!from && !!to,
    queryFn: () =>
      api.get<UnitsInPeriod>("/unit-payments/units", {
        from: from!.toISOString(),
        to: to!.toISOString(),
      }),
  });
}

export interface UnitDetailRow {
  order_number: string;
  created_at: string;
  delivered_at: string;
  units: number;
}

/** Desglose pedido a pedido del número de prendas, para poder auditarlo. */
export function useUnitsDetail(from: Date | undefined, to: Date | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["unit_payment_units_detail", from?.toISOString(), to?.toISOString()],
    enabled: enabled && !!from && !!to,
    queryFn: () =>
      api.get<UnitDetailRow[]>("/unit-payments/units/detail", {
        from: from!.toISOString(),
        to: to!.toISOString(),
      }),
  });
}

export function useUnitPaymentRuns() {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.get<UnitPaymentRun[]>("/unit-payments"),
  });
}

export interface NewUnitPaymentInput {
  period_from: string;
  period_to: string;
  rate_per_unit: number;
  notes?: string | null;
  /** Genera el pago aunque el periodo se cruce con otro ya pagado (el server lo rechaza si no). */
  force?: boolean;
}

/** El gasto de nómina que genera este pago también mueve el libro y los KPIs. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QK });
  qc.invalidateQueries({ queryKey: ["unit_payment_units"] });
  qc.invalidateQueries({ queryKey: ["unit_payment_units_detail"] });
  qc.invalidateQueries({ queryKey: ["financial_transactions"] });
  qc.invalidateQueries({ queryKey: ["finance_summary"] });
  qc.invalidateQueries({ queryKey: ["finance_reconciliation"] });
  qc.invalidateQueries({ queryKey: ["finance_trend"] });
  qc.invalidateQueries({ queryKey: ["bi"] });
}

export function useCreateUnitPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ force, ...body }: NewUnitPaymentInput) =>
      api.post<UnitPaymentRun>("/unit-payments", body, force ? { force: "true" } : undefined),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteUnitPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/unit-payments/${id}`),
    onSuccess: () => invalidateAll(qc),
  });
}
