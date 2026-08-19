import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Wallet, ArrowDownCircle, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/features/bi/KpiCard";
import {
  PAYMENT_CHANNEL_LABEL,
  useReconciliation,
  type Reconciliation,
} from "./api";

const cop = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

function buildChartData(rec: Reconciliation) {
  return rec.by_method
    .filter((r) => r.sales > 0 || r.income > 0)
    .map((r) => ({
      label: PAYMENT_CHANNEL_LABEL[r.method] ?? r.method,
      sales: r.sales,
      income: r.income,
    }));
}

export function ReconciliationChart({ month }: { month: string }) {
  const { data, isLoading } = useReconciliation(month);

  const chartData = data ? buildChartData(data) : [];

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-2 p-4">
        <div>
          <h3 className="text-sm font-semibold">Ventas vs. Ingresos por método</h3>
          <p className="text-xs text-muted-foreground">
            Ventas de las órdenes del mes contra lo realmente registrado como ingreso.
          </p>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cargando conciliación...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin ventas ni ingresos en el mes seleccionado.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `$${Number(v) / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    cop(Number(value)),
                    name === "sales" ? "Ventas (órdenes)" : "Ingresado",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(v) => (v === "sales" ? "Ventas (órdenes)" : "Ingresado")}
                />
                <Bar dataKey="sales" fill="hsl(222 47% 40%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="income" fill="hsl(142 71% 38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

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
          value={cop(data?.net ?? 0)}
          hint="Ingresado − gastado"
          icon={Scale}
          tone={(data?.net ?? 0) >= 0 ? "green" : "red"}
        />
      </div>
    </div>
  );
}
