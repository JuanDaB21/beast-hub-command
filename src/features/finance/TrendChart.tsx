import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { useFinanceTrend } from "./api";

const cop = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

/** "2026-08" -> "ago 26" */
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return format(new Date(y, (m ?? 1) - 1, 1), "MMM yy", { locale: es });
}

const SERIES: { key: "sales" | "income" | "expenses"; label: string; color: string }[] = [
  { key: "sales", label: "Ventas (órdenes)", color: "hsl(222 47% 45%)" },
  { key: "income", label: "Ingresos", color: "hsl(142 71% 38%)" },
  { key: "expenses", label: "Gastos", color: "hsl(0 72% 51%)" },
];

export function TrendChart({ month, months = 6 }: { month: string; months?: number }) {
  const { data, isLoading } = useFinanceTrend(month, months);

  const chartData = (data ?? []).map((p) => ({ ...p, label: monthLabel(p.month) }));
  const hasData = chartData.some((p) => p.sales || p.income || p.expenses);

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div>
        <h3 className="text-sm font-semibold">Comportamiento mes a mes</h3>
        <p className="text-xs text-muted-foreground">
          Ventas, ingresos y gastos de los últimos {months} meses.
        </p>
      </div>
      <div style={{ width: "100%", height: 300 }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cargando histórico...
          </div>
        ) : !hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin movimientos en el periodo.
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                width={48}
                tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => {
                  const s = SERIES.find((x) => x.key === name);
                  return [cop(Number(value)), s?.label ?? name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(v) => SERIES.find((x) => x.key === v)?.label ?? v}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
