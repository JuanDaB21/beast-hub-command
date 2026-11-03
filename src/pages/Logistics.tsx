import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { codStage, slaFromCreatedAt, useShipmentOrders, type ShipmentOrder } from "@/features/logistics/api";
import { FulfillmentBoard } from "@/features/logistics/FulfillmentBoard";
import { CodCollectionPanel } from "@/features/logistics/CodCollectionPanel";
import { KpiTile } from "@/features/logistics/KpiTile";
import { StatStrip } from "@/components/shared/StatStrip";
import { ShipDialog } from "@/features/logistics/ShipDialog";
import { matchesAllTokens } from "@/lib/textSearch";

/** Estados del pipeline de despacho; los COD entregados solo salen en recaudo. */
const DISPATCH_STATUSES = ["pending", "processing", "shipped"];

export default function Logistics() {
  const { data: orders = [], isLoading } = useShipmentOrders();
  const [filter, setFilter] = useState("");
  const [shipTarget, setShipTarget] = useState<ShipmentOrder | null>(null);

  const filtered = useMemo(() => {
    if (!filter.trim()) return orders;
    return orders.filter((o) =>
      matchesAllTokens(
        `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.tracking_number ?? ""}`,
        filter,
      ),
    );
  }, [orders, filter]);

  const dispatchOrders = useMemo(
    () => filtered.filter((o) => DISPATCH_STATUSES.includes(o.status)),
    [filtered],
  );

  const stats = useMemo(() => {
    let green = 0, yellow = 0, red = 0, missingTracking = 0;
    for (const o of dispatchOrders) {
      if (o.status === "shipped" && !o.tracking_number) missingTracking++;
      const t = slaFromCreatedAt(o.created_at).tone;
      if (t === "green") green++;
      else if (t === "yellow") yellow++;
      else red++;
    }
    return { total: dispatchOrders.length, green, yellow, red, missingTracking };
  }, [dispatchOrders]);

  const codPending = useMemo(
    () => filtered.filter((o) => o.is_cod && codStage(o) !== "collected").length,
    [filtered],
  );

  return (
    <AppShell
      title="Logística"
      description="Despacho por SLA, guías y recaudo contraentrega."
    >
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="dispatch">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
              <TabsTrigger value="dispatch">Despacho ({stats.total})</TabsTrigger>
              <TabsTrigger value="cod">Recaudo COD ({codPending})</TabsTrigger>
            </TabsList>
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Pedido, cliente, teléfono o guía"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value="dispatch" className="mt-4 flex flex-col gap-4">
            <StatStrip cols={5}>
              <KpiTile label="En flujo" value={String(stats.total)} />
              <KpiTile label="Estándar, hasta 48 h" value={String(stats.green)} tone="green" />
              <KpiTile label="Prioridad, 48 a 72 h" value={String(stats.yellow)} tone="yellow" />
              <KpiTile label="Crítico, más de 72 h" value={String(stats.red)} tone="red" />
              <KpiTile
                label="Sin guía"
                value={String(stats.missingTracking)}
                hint={stats.missingTracking > 0 ? "despachados sin registrarla" : undefined}
                tone={stats.missingTracking > 0 ? "red" : undefined}
              />
            </StatStrip>
            <FulfillmentBoard orders={dispatchOrders} onShip={(o) => setShipTarget(o)} />
          </TabsContent>

          <TabsContent value="cod" className="mt-4">
            <CodCollectionPanel orders={filtered} onShip={(o) => setShipTarget(o)} />
          </TabsContent>
        </Tabs>
      )}

      <ShipDialog
        order={shipTarget}
        open={!!shipTarget}
        onOpenChange={(open) => !open && setShipTarget(null)}
      />
    </AppShell>
  );
}
