import { TrendingUp, Wallet, ArrowDownCircle } from "lucide-react";
import { KpiCard } from "@/features/bi/KpiCard";
import { useFinanceSummary } from "./api";

const cop = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

/** Fila de totales acumulados de todo el tiempo (ventas, ingresos, gastos). */
export function FinanceGlobalKpis() {
  const { data } = useFinanceSummary();

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Acumulado histórico · todo el tiempo
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Ventas históricas"
          value={cop(data?.sales_total ?? 0)}
          hint="Total facturado en órdenes"
          icon={TrendingUp}
          tone="primary"
        />
        <KpiCard
          label="Ingresos históricos"
          value={cop(data?.income_total ?? 0)}
          hint="Todo lo registrado como ingreso"
          icon={Wallet}
          tone="green"
        />
        <KpiCard
          label="Gastos históricos"
          value={cop(data?.expenses_total ?? 0)}
          hint="Todo lo registrado como gasto"
          icon={ArrowDownCircle}
          tone="red"
        />
      </div>
    </div>
  );
}
