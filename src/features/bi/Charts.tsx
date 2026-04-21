import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

const PIE_COLORS = [
  "hsl(222 47% 14%)",
  "hsl(24 95% 53%)",
  "hsl(38 92% 50%)",
  "hsl(142 71% 38%)",
  "hsl(200 80% 45%)",
  "hsl(280 60% 50%)",
];

function fmtDay(d: string) {
  // YYYY-MM-DD -> DD/MM
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}

function ChartCard({ title, subtitle, children, height = 280 }: ChartCardProps) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children as any}</ResponsiveContainer>
      </div>
    </Card>
  );
}

export function SalesLineChart({
  data,
}: {
  data: { date: string; revenue: number; orders: number }[];
}) {
  if (data.length === 0) {
    return (
      <ChartCard title="Ventas vs. Tiempo" subtitle="Sin datos en el rango seleccionado">
        <div />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Ventas vs. Tiempo" subtitle="Ingresos por día">
      <LineChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v / 1000}k`} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) =>
            name === "revenue" ? [currency(value), "Ingresos"] : [value, "Pedidos"]
          }
          labelFormatter={(l) => `Día ${fmtDay(l as string)}`}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartCard>
  );
}

export function TopProductsBarChart({
  data,
}: {
  data: { name: string; quantity: number; revenue: number }[];
}) {
  if (data.length === 0) {
    return (
      <ChartCard title="Top 5 Productos" subtitle="Sin ventas en el rango">
        <div />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Top 5 Productos" subtitle="Por unidades vendidas">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          type="category"
          dataKey="name"
          fontSize={11}
          stroke="hsl(var(--muted-foreground))"
          width={120}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) =>
            name === "quantity" ? [value, "Unidades"] : [currency(value), "Ingresos"]
          }
        />
        <Bar dataKey="quantity" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartCard>
  );
}

export function ReturnsPieChart({
  data,
}: {
  data: { reason: string; value: number }[];
}) {
  if (data.length === 0) {
    return (
      <ChartCard title="Motivos de Devolución" subtitle="Sin devoluciones en el rango">
        <div />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Motivos de Devolución" subtitle="Distribución por categoría">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="reason"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
          label={(entry: any) => entry.reason}
          labelLine={false}
          fontSize={11}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [`${value} dev.`, ""]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ChartCard>
  );
}

export function RevenueByChannelChart({
  data,
}: {
  data: { key: string; label: string; total: number; count: number }[];
}) {
  const filtered = data.filter((d) => d.total > 0 || d.count > 0);
  if (filtered.length === 0) {
    return (
      <ChartCard title="Ingresos por canal de pago" subtitle="Sin ingresos en el rango">
        <div />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Ingresos por canal de pago" subtitle="Monto recibido por método">
      <BarChart data={filtered} layout="vertical" margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => currency(Number(v))} />
        <YAxis type="category" dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" width={120} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string, ctx: any) => {
            if (name === "total") return [currency(value), "Ingresos"];
            if (name === "count") return [value, "Pedidos"];
            return [value, name];
          }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {filtered.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

