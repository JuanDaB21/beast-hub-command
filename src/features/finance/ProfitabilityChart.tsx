import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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

type SeriesKey = "net" | "projected" | "accumulated";

const SERIES: { key: SeriesKey; label: string; color: string; dashed?: boolean }[] = [
  { key: "net", label: "Rentabilidad neta (caja)", color: "hsl(142 71% 38%)" },
  { key: "projected", label: "Rentabilidad proyectada", color: "hsl(222 47% 45%)" },
  { key: "accumulated", label: "Neta acumulada", color: "hsl(38 92% 50%)", dashed: true },
];

/**
 * Resultado mes a mes, derivado de la misma serie que alimenta TrendChart
 * (`GET /finance/trend` ya devuelve ventas, ingresos y gastos por mes; React Query
 * comparte la respuesta cacheada, así que esta gráfica no dispara otra petición).
 *
 *   neta        = ingresos - gastos   → plata que realmente entró menos la que salió
 *   proyectada  = ventas   - gastos   → lo que dará el mes cuando se cobre todo
 *   acumulada   = suma corrida de la neta en la ventana → recuperación de la inversión
 */
export function ProfitabilityChart({ month, months = 6 }: { month: string; months?: number }) {
  const { data, isLoading } = useFinanceTrend(month, months);

  let running = 0;
  const chartData = (data ?? []).map((p) => {
    const net = p.income - p.expenses;
    running += net;
    return {
      label: monthLabel(p.month),
      net,
      projected: p.sales - p.expenses,
      accumulated: running,
    };
  });
  const hasData = chartData.some((p) => p.net || p.projected || p.accumulated);

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div>
        <h3 className="text-sm font-semibold">Rentabilidad mes a mes</h3>
        <p className="text-xs text-muted-foreground">
          Neta (ingresos − gastos) y proyectada (ventas − gastos) de los últimos {months} meses.
          La línea acumulada bajo cero significa que la inversión aún no se recupera.
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
                width={60}
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
              {/* Frontera ganancia / pérdida. */}
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  dot={s.dashed ? false : { r: 3 }}
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
