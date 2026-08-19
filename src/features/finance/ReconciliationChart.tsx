import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  SALES_SOURCE_LABEL,
  useReconciliation,
  type Reconciliation,
} from "./api";

const cop = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const kFormat = (v: number) => `$${Math.round(Number(v) / 1000)}k`;

const EXPENSE_COLORS = [
  "hsl(0 72% 51%)",
  "hsl(24 80% 50%)",
  "hsl(43 74% 49%)",
  "hsl(280 55% 55%)",
  "hsl(200 60% 45%)",
  "hsl(160 55% 40%)",
  "hsl(320 55% 52%)",
  "hsl(220 15% 55%)",
];

function buildSourceData(rec: Reconciliation) {
  return rec.by_source
    .filter((r) => r.sales > 0 || r.income > 0)
    .map((r) => ({
      label: SALES_SOURCE_LABEL[r.source] ?? r.source,
      sales: r.sales,
      income: r.income,
    }));
}

export function ReconciliationChart({ month }: { month: string }) {
  const { data, isLoading } = useReconciliation(month);

  const sourceData = data ? buildSourceData(data) : [];
  const expenseData = data
    ? data.expenses_by_category.filter((r) => r.amount > 0)
    : [];
  const expensesTotal = data?.expenses_total ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Ventas vs Ingresos por origen */}
      <Card className="flex flex-col gap-2 p-4">
        <div>
          <h3 className="text-sm font-semibold">Conciliación por origen</h3>
          <p className="text-xs text-muted-foreground">
            Ventas de las órdenes contra lo registrado como ingreso, por canal.
          </p>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cargando conciliación...
            </div>
          ) : sourceData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin ventas ni ingresos en el mes.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={sourceData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  width={48}
                  tickFormatter={kFormat}
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
                <Bar dataKey="sales" fill="hsl(222 47% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="income" fill="hsl(142 71% 38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Gastos del mes por categoría */}
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Gastos por categoría</h3>
            <p className="text-xs text-muted-foreground">Desglose de gastos del mes.</p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-status-red">
            {cop(expensesTotal)}
          </span>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cargando gastos...
            </div>
          ) : expenseData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin gastos en el mes.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={expenseData}
                margin={{ top: 5, right: 12, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={kFormat}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [cop(Number(value)), "Gasto"]}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {expenseData.map((_, i) => (
                    <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
