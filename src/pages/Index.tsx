import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Package,
  TrendingUp,
  Undo2,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import {
  RANGE_OPTIONS,
  rangeFromKey,
  useBiData,
  useRevenueByPaymentMethod,
  type RangeKey,
} from "@/features/bi/api";
import { KpiCard } from "@/features/bi/KpiCard";
import {
  ReturnsPieChart,
  RevenueByChannelChart,
  SalesLineChart,
  TopProductsBarChart,
} from "@/features/bi/Charts";
import { MonthlyClosureTable } from "@/features/bi/MonthlyClosureTable";
import { Card } from "@/components/ui/card";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

export default function Index() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const range = useMemo(() => rangeFromKey(rangeKey), [rangeKey]);
  const { data, isLoading } = useBiData(range);
  const { data: channels } = useRevenueByPaymentMethod(range);

  return (
    <AppShell
      title="Dashboard · BI & Finanzas"
      description="Rentabilidad real, eficiencia operativa y salud del inventario."
      actions={
        <Tabs value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
          <TabsList>
            {RANGE_OPTIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      {isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Ingresos totales"
              value={currency(data.revenue)}
              hint={`${data.ordersCount} pedidos · ${currency(data.revenueShopify)} Shopify`}
              icon={DollarSign}
              tone="primary"
            />
            <KpiCard
              label="Costo de insumos"
              value={currency(data.cogs)}
              hint="Suma BOM × unidades"
              icon={Package}
            />
            <KpiCard
              label="Margen neto"
              value={currency(data.margin)}
              hint={`${data.marginPct.toFixed(1)}% rentabilidad`}
              icon={TrendingUp}
              tone={data.margin >= 0 ? "green" : "red"}
            />
            <KpiCard
              label="Tasa de devoluciones"
              value={`${(data.returnsRate * 100).toFixed(1)}%`}
              hint={`${data.scrapCount} mermas registradas`}
              icon={Undo2}
              tone={
                data.returnsRate > 0.1 ? "red" : data.returnsRate > 0.05 ? "yellow" : "green"
              }
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              label="Ingresos WhatsApp"
              value={currency(data.revenueManual)}
              icon={ShoppingCart}
              tone="default"
            />
            <KpiCard
              label="Ingresos Shopify"
              value={currency(data.revenueShopify)}
              icon={ShoppingCart}
              tone="default"
            />
          </div>

          {/* Ingresos por canal de pago */}
          {channels && channels.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Canales de pago</div>
                <div className="space-y-2">
                  {channels.map((c) => (
                    <div
                      key={c.key}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground">{c.count} pedidos</div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{currency(c.total)}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <RevenueByChannelChart data={channels} />
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <SalesLineChart data={data.salesByDay} />
            </div>
            <ReturnsPieChart data={data.returnReasons} />
            <div className="lg:col-span-2 xl:col-span-3">
              <TopProductsBarChart data={data.topProducts} />
            </div>
          </div>

          {/* Cierre mensual */}
          <MonthlyClosureTable rows={data.monthlyClosure} />

          {data.cogs === 0 && data.revenue > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-status-yellow/30 bg-status-yellow/5 p-3 text-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-yellow" />
              <div>
                <strong>Costo de insumos en cero:</strong> aún no hay recetas (BOM) configuradas
                para los productos vendidos. Configura las recetas en{" "}
                <span className="font-medium">Producción → Recetas</span> para obtener un margen
                preciso.
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
