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
  PAYMENT_CHANNEL_LABEL,
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

function buildChannelData(rec: Reconciliation) {
  return rec.by_payment_method.map((r) => ({
    label: PAYMENT_CHANNEL_LABEL[r.channel] ?? r.channel,
    collected: r.collected,
    income: r.income,
  }));
}

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
  const channelData = data ? buildChannelData(data) : [];
  const shipping = data?.shipping;
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

      {/*
        Conciliación por vía de cobro: por dónde debió entrar la plata contra lo
        que se registró en el libro. A diferencia de la tarjeta de origen, el
        lado esperado es plata YA COBRADA (COD entregados, prepagos verificados),
        que es lo que de verdad tiene que aparecer como ingreso.
      */}
      <Card className="flex flex-col gap-2 p-4">
        <div>
          <h3 className="text-sm font-semibold">Conciliación por vía de cobro</h3>
          <p className="text-xs text-muted-foreground">
            Plata cobrada en el mes contra lo registrado como ingreso. En COD, la
            diferencia es lo que la transportadora aún no ha girado.
          </p>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cargando conciliación...
            </div>
          ) : channelData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin cobros ni ingresos en el mes.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={channelData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
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
                    name === "collected" ? "Cobrado" : "Ingresado",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(v) => (v === "collected" ? "Cobrado" : "Ingresado")}
                />
                <Bar dataKey="collected" fill="hsl(222 47% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="income" fill="hsl(142 71% 38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/*
        Envíos: el cliente paga el envío como línea del pedido y la empresa le
        paga el flete a la transportadora. Casi todo lo cobrado se va en el
        flete, así que lo que hay que vigilar es el neto.
      */}
      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">Envíos del mes</h3>
          <p className="text-xs text-muted-foreground">
            Lo cobrado al cliente contra el flete pagado a la transportadora.
          </p>
        </div>
        {isLoading || !shipping ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Cargando envíos...
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cobrado al cliente</span>
              <span className="tabular-nums font-medium">{cop(shipping.charged)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pagado a la transportadora</span>
              <span className="tabular-nums font-medium text-status-red">
                −{cop(shipping.paid)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-medium">Neto envíos</span>
              <span
                className={`tabular-nums font-semibold ${
                  shipping.net < 0 ? "text-status-red" : "text-status-green"
                }`}
              >
                {cop(shipping.net)}
              </span>
            </div>
            {shipping.missing_cost_orders > 0 && (
              <div className="mt-1 rounded-md border border-status-yellow/30 bg-status-yellow/5 p-2 text-xs">
                <span className="font-medium text-status-yellow">
                  {shipping.missing_cost_orders} pedidos despachados sin costo de flete
                </span>
                <span className="text-muted-foreground">
                  {" "}· el margen sale inflado hasta capturarlo en Logística.
                </span>
              </div>
            )}
          </div>
        )}
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
