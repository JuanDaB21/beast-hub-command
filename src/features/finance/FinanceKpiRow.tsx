import { TrendingUp, Wallet, ArrowDownCircle, Scale } from "lucide-react";
import { KpiCard } from "@/features/bi/KpiCard";
import { useReconciliation } from "./api";

const cop = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

/** Fila única de KPIs del mes, alimentada por el endpoint de conciliación. */
export function FinanceKpiRow({ month }: { month: string }) {
  const { data } = useReconciliation(month);
  const net = data?.net ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Ventas del mes"
        value={cop(data?.sales_total ?? 0)}
        hint="Total facturado en órdenes"
        icon={TrendingUp}
        tone="primary"
      />
      <KpiCard
        label="Ingresado"
        value={cop(data?.income_total ?? 0)}
        hint="Ingresos registrados"
        icon={Wallet}
        tone="green"
      />
      <KpiCard
        label="Gastado"
        value={cop(data?.expenses_total ?? 0)}
        hint="Gastos del mes"
        icon={ArrowDownCircle}
        tone="red"
      />
      <KpiCard
        label="Neto"
        value={cop(net)}
        hint="Ingresado − gastado"
        icon={Scale}
        tone={net >= 0 ? "green" : "red"}
      />
    </div>
  );
}
