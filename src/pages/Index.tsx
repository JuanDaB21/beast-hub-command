import { ReactNode, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, TrendingUp, Undo2, ShoppingCart, AlertCircle, Truck } from "lucide-react";
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
import { StatStrip } from "@/components/shared/StatStrip";
import { cn } from "@/lib/utils";

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold leading-none">{title}</h2>
        {hint && <p className="hidden text-xs text-muted-foreground sm:block">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function Index() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const range = useMemo(() => rangeFromKey(rangeKey), [rangeKey]);
  const { data, isLoading } = useBiData(range);
  const { data: channels } = useRevenueByPaymentMethod(range);

  return (
    <AppShell title="Dashboard" description="Rentabilidad real, eficiencia operativa y salud del inventario.">
      <Tabs value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)} className="mb-5">
        <TabsList className="w-full justify-start sm:w-auto">
          {RANGE_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value} className="shrink-0 text-xs sm:text-sm">
              {opt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <Skeleton className="h-56 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[6.5rem] w-full rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
          {data.cogs === 0 && data.revenue > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Costo de insumos en cero:</strong> aún no hay recetas configuradas para los
                productos vendidos, así que el margen sale inflado. Configúralas en Producción, Recetas.
              </div>
            </div>
          )}

          {/* Cifra héroe: lo que de verdad queda */}
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <div className="relative overflow-hidden rounded-xl border bg-card p-5 sm:p-6">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand" />
              <p className="text-sm font-medium text-muted-foreground">Margen neto del periodo</p>
              <p
                className={cn(
                  "tabular mt-2 font-display text-[3.25rem] font-bold leading-[0.9] tracking-tight sm:text-[4.5rem]",
                  data.margin >= 0 ? "text-foreground" : "text-danger",
                )}
              >
                {currency(data.margin)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className={cn("font-semibold", data.margin >= 0 ? "text-success" : "text-danger")}>
                  {data.marginPct.toFixed(1)}%
                </span>{" "}
                de rentabilidad sobre {currency(data.revenue)} en ventas.
              </p>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-t pt-4">
                <HeroStat label="Pedidos" value={data.ordersCount.toLocaleString("es-CO")} />
                <HeroStat label="Prendas" value={data.unitsSold.toLocaleString("es-CO")} />
                <HeroStat label="Ticket" value={currency(data.avgTicket)} />
              </dl>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <KpiCard
                label="Margen por prenda"
                value={currency(data.marginPerUnit)}
                hint={`${data.marginPct.toFixed(1)}% sobre ingresos`}
                icon={TrendingUp}
                tone={data.marginPerUnit >= 0 ? "green" : "red"}
                size="compact"
              />
              <KpiCard
                label="Costo de insumos"
                value={currency(data.cogs)}
                hint="Receta, impresión, planchado y procesos"
                icon={Package}
                size="compact"
              />
              <KpiCard
                label="Flete pagado"
                value={currency(data.shippingCost)}
                hint={
                  data.returnsCost > 0
                    ? `Más ${currency(data.returnsCost)} en devoluciones`
                    : "Pagado a la transportadora"
                }
                icon={Truck}
                size="compact"
              />
              <KpiCard
                label="Devoluciones"
                value={`${(data.returnsRate * 100).toFixed(1)}%`}
                hint={`${data.scrapCount} mermas registradas`}
                icon={Undo2}
                tone={data.returnsRate > 0.1 ? "red" : data.returnsRate > 0.05 ? "yellow" : "green"}
                size="compact"
              />
            </div>
          </div>

          {data.unitsUnlinked > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {data.unitsUnlinked} prenda(s) vendida(s) sin producto vinculado: no suman costo al margen.
              </div>
            </div>
          )}

          {/*
            Envíos: el cliente paga el envío como línea del pedido y casi todo se
            va en el flete. El margen neto ya lo tiene descontado, pero el neto
            de envíos es invisible ahí y es lo que conviene vigilar.
          */}
          <Section title="Envíos" hint="El margen neto ya descuenta el flete">
            <StatStrip cols={3}>
              <KpiCard
                label="Envíos cobrados"
                value={currency(data.shippingCharged)}
                hint="Cobrado al cliente, dentro de los ingresos"
                size="compact"
              />
              <KpiCard
                label="Neto envíos"
                value={currency(data.shippingNet)}
                hint={data.shippingNet < 0 ? "La empresa subsidia parte del flete" : "Cobrado menos flete real"}
                tone={data.shippingNet >= 0 ? "green" : "red"}
                size="compact"
              />
              <KpiCard
                label="Despachados sin flete"
                value={data.ordersMissingShippingCost.toLocaleString("es-CO")}
                hint={
                  data.ordersMissingShippingCost > 0
                    ? "Inflan el margen: captura el costo en Logística"
                    : "Todos tienen su flete registrado"
                }
                tone={data.ordersMissingShippingCost > 0 ? "yellow" : "green"}
                size="compact"
              />
            </StatStrip>
          </Section>

          <Section title="Ventas">
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <SalesLineChart data={data.salesByDay} />
              </div>
              <ReturnsPieChart data={data.returnReasons} />
              <div className="lg:col-span-2 xl:col-span-3">
                <TopProductsBarChart data={data.topProducts} />
              </div>
            </div>
          </Section>

          <Section title="Canales">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <KpiCard label="WhatsApp" value={currency(data.revenueManual)} icon={ShoppingCart} size="compact" />
              <KpiCard label="Shopify" value={currency(data.revenueShopify)} icon={ShoppingCart} size="compact" />
            </div>
            {channels && channels.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
                <Card className="p-4">
                  <div className="mb-3 text-sm font-semibold">Canales de pago</div>
                  <ul className="divide-y">
                    {channels.map((c) => (
                      <li key={c.key} className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="text-sm font-medium">{c.label}</div>
                          <div className="text-xs text-muted-foreground">{c.count} pedidos</div>
                        </div>
                        <div className="tabular font-display text-lg font-semibold">{currency(c.total)}</div>
                      </li>
                    ))}
                  </ul>
                </Card>
                <RevenueByChannelChart data={channels} />
              </div>
            )}
          </Section>

          <MonthlyClosureTable rows={data.monthlyClosure} />
        </div>
      )}
    </AppShell>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 truncate font-display text-xl font-semibold leading-none sm:text-2xl">{value}</dd>
    </div>
  );
}
