import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { slaFromCreatedAt, useShipmentOrders, type ShipmentOrder } from "@/features/logistics/api";
import { FulfillmentBoard } from "@/features/logistics/FulfillmentBoard";
import { ShipDialog } from "@/features/logistics/ShipDialog";

export default function Logistics() {
  const { data: orders = [], isLoading } = useShipmentOrders();
  const [filter, setFilter] = useState("");
  const [shipTarget, setShipTarget] = useState<ShipmentOrder | null>(null);

  const filtered = useMemo(() => {
    const v = filter.trim().toLowerCase();
    if (!v) return orders;
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(v) ||
        o.customer_name.toLowerCase().includes(v) ||
        o.customer_phone.toLowerCase().includes(v) ||
        (o.tracking_number ?? "").toLowerCase().includes(v),
    );
  }, [orders, filter]);

  const stats = useMemo(() => {
    let green = 0, yellow = 0, red = 0, shipped = 0;
    for (const o of orders) {
      if (o.status === "shipped") shipped++;
      const t = slaFromCreatedAt(o.created_at).tone;
      if (t === "green") green++;
      else if (t === "yellow") yellow++;
      else red++;
    }
    return { total: orders.length, green, yellow, red, shipped };
  }, [orders]);

  return (
    <AppShell
      title="Módulo 6 · Logística"
      description="Panel de fulfillment con SLA semafórico y captura de guías."
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPI label="En flujo" value={String(stats.total)} />
        <KPI label="Estándar (≤48h)" value={String(stats.green)} tone="green" />
        <KPI label="Prioridad (48-72h)" value={String(stats.yellow)} tone="yellow" />
        <KPI label="Crítico (+72h)" value={String(stats.red)} tone="red" />
        <KPI label="Enviados" value={String(stats.shipped)} />
      </div>

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
        <FulfillmentBoard orders={filtered} onShip={(o) => setShipTarget(o)} />
      )}

      <ShipDialog
        order={shipTarget}
        open={!!shipTarget}
        onOpenChange={(open) => !open && setShipTarget(null)}
      />
    </AppShell>
  );
}

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "yellow" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "text-status-red"
      : tone === "yellow"
        ? "text-status-yellow"
        : tone === "green"
          ? "text-status-green"
          : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${toneClass}`}>
        {value}
      </div>
    </Card>
  );
}
