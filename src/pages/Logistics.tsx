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
      title="Módulo 6 · Logística"
      description="Despacho con SLA semafórico, captura de guías y recaudo contra-entrega."
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por # pedido, cliente, teléfono o guía..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="dispatch">
          <TabsList>
            <TabsTrigger value="dispatch">Despacho ({stats.total})</TabsTrigger>
            <TabsTrigger value="cod">Recaudo COD ({codPending})</TabsTrigger>
          </TabsList>

          <TabsContent value="dispatch" className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <KpiTile label="En flujo" value={String(stats.total)} />
              <KpiTile label="Estándar (≤48h)" value={String(stats.green)} tone="green" />
              <KpiTile label="Prioridad (48-72h)" value={String(stats.yellow)} tone="yellow" />
              <KpiTile label="Crítico (+72h)" value={String(stats.red)} tone="red" />
              <KpiTile
                label="Sin guía"
                value={String(stats.missingTracking)}
                hint={stats.missingTracking > 0 ? "despachados sin registrarla" : undefined}
                tone={stats.missingTracking > 0 ? "red" : undefined}
              />
            </div>
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
