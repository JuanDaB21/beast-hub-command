import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { PackageCheck, Truck, Clock, Hash } from "lucide-react";
import { slaFromCreatedAt, type ShipmentOrder } from "./api";
import { STATUS_LABEL } from "@/features/orders/status";
import { statusTone } from "@/features/orders/status";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  orders: ShipmentOrder[];
  onShip: (order: ShipmentOrder) => void;
}

export function FulfillmentBoard({ orders, onShip }: Props) {
  if (orders.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <PackageCheck className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No hay pedidos en flujo de fulfillment.</p>
      </Card>
    );
  }

  // Orden: rojos primero, luego amarillos, verdes; dentro del mismo tono, los más viejos arriba
  const sorted = [...orders].sort((a, b) => {
    const sa = slaFromCreatedAt(a.created_at);
    const sb = slaFromCreatedAt(b.created_at);
    const order = { red: 0, yellow: 1, green: 2 } as const;
    if (order[sa.tone] !== order[sb.tone]) return order[sa.tone] - order[sb.tone];
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((o) => (
        <ShipmentCard key={o.id} order={o} onShip={() => onShip(o)} />
      ))}
    </div>
  );
}

function ShipmentCard({ order, onShip }: { order: ShipmentOrder; onShip: () => void }) {
  const sla = slaFromCreatedAt(order.created_at);
  const itemCount = order.items.reduce((acc, it) => acc + it.quantity, 0);
  const isShipped = order.status === "shipped";

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted-foreground">{order.order_number}</div>
          <div className="truncate text-base font-semibold">{order.customer_name}</div>
        </div>
        <StatusBadge tone={sla.tone} label={sla.label} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {Math.floor(sla.hours)}h
        </Badge>
        <StatusBadge tone={statusTone(order.status)} label={STATUS_LABEL[order.status]} />
        {order.is_cod && (
          <Badge variant={order.cod_confirmed ? "default" : "destructive"}>
            COD {order.cod_confirmed ? "✓" : "?"}
          </Badge>
        )}
        <span>·</span>
        <span>{itemCount} pzs</span>
        <span>·</span>
        <span className="tabular-nums">{currency(Number(order.total))}</span>
      </div>

      {order.tracking_number && (
        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
          <Hash className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{order.tracking_number}</span>
        </div>
      )}

      {Number(order.shipping_cost) > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-xs">
          <span className="text-muted-foreground">Costo de envío</span>
          <span className="tabular-nums font-medium">{currency(Number(order.shipping_cost))}</span>
        </div>
      )}

      {sla.tone === "red" && order.delay_reason && (
        <div className="rounded-md border border-status-red/30 bg-status-red/5 p-2 text-xs">
          <div className="font-medium text-status-red">Motivo del retraso</div>
          <div className="text-muted-foreground">{order.delay_reason}</div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <WhatsAppContactButton
          phone={order.customer_phone}
          message={
            isShipped && order.tracking_number
              ? `Hola ${order.customer_name}, tu pedido ${order.order_number} ya fue despachado. Guía Inter Rapidísimo: ${order.tracking_number}`
              : `Hola ${order.customer_name}, te escribo de Beast Club sobre tu pedido ${order.order_number}.`
          }
          label="WhatsApp"
        />
        <Button size="sm" variant={isShipped ? "outline" : "default"} className="gap-1.5" onClick={onShip}>
          {isShipped ? (
            <>
              <Hash className="h-4 w-4" />
              Editar guía
            </>
          ) : (
            <>
              <Truck className="h-4 w-4" />
              Despachar
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
