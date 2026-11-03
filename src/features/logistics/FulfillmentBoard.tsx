import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { PackageCheck, Truck, Clock, Hash, AlertTriangle, ClipboardCheck } from "lucide-react";
import {
  needsOrderConfirmation,
  slaFromCreatedAt,
  useConfirmCodOrder,
  useMarkDelivered,
  type ShipmentOrder,
} from "./api";
import { countGarments } from "@/features/orders/api";
import { STATUS_LABEL } from "@/features/orders/status";
import { statusTone } from "@/features/orders/status";

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

interface Props {
  orders: ShipmentOrder[];
  onShip: (order: ShipmentOrder) => void;
}

export function FulfillmentBoard({ orders, onShip }: Props) {
  if (orders.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-10 text-center">
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

export function ShipmentCard({ order, onShip }: { order: ShipmentOrder; onShip: () => void }) {
  const sla = slaFromCreatedAt(order.created_at);
  const itemCount = countGarments(order.items);
  const isShipped = order.status === "shipped";
  // Los COD entregados siguen en el tablero hasta que se concilia su recaudo,
  // así que la tarjeta también se renderiza para ellos.
  const isDispatched = isShipped || order.status === "delivered";
  const markDelivered = useMarkDelivered();
  const confirmOrder = useConfirmCodOrder();

  // Los COD de Shopify no se despachan sin la llamada de confirmación: es el
  // filtro anti-pedido-falso y hasta ahora vivía en otra página, sin bloquear
  // nada.
  const pendingConfirmation = needsOrderConfirmation(order);
  const missingTracking = isShipped && !order.tracking_number;

  const handleDelivered = async () => {
    try {
      await markDelivered.mutateAsync(order.id);
      toast.success(
        order.is_cod
          ? `Pedido ${order.order_number} entregado · recaudo a cargo de la transportadora`
          : `Pedido ${order.order_number} entregado`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo marcar como entregado");
    }
  };

  const handleConfirmOrder = async () => {
    try {
      await confirmOrder.mutateAsync(order.id);
      toast.success(`Pedido ${order.order_number} confirmado con el cliente`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo confirmar el pedido");
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="tabular text-xs text-muted-foreground">{order.order_number}</div>
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
          <StatusBadge tone={order.cod_confirmed ? "green" : "yellow"} label={order.cod_confirmed ? "COD cobrado" : "COD por cobrar"} />
        )}
        <span>{itemCount} prenda{itemCount === 1 ? "" : "s"}</span>
        <span className="tabular ml-auto font-display text-lg font-semibold leading-none text-foreground">
          {currency(Number(order.total))}
        </span>
      </div>

      {order.tracking_number ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-2 text-sm">
          {/* La guía es lo primero que busca el operativo para rastrear. */}
          <Hash className="h-3 w-3 text-muted-foreground" />
          <span className="tabular">{order.tracking_number}</span>
        </div>
      ) : (
        missingTracking && (
          <div className="flex items-center gap-2 rounded-lg bg-danger-soft px-2.5 py-2 text-sm text-danger-ink">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">Sin guía.</span>
            <span>Despachado sin registrarla</span>
          </div>
        )
      )}

      {pendingConfirmation && (
        <div className="rounded-lg bg-warning-soft px-2.5 py-2 text-xs text-warning-ink">
          <div className="text-sm font-semibold">Pendiente de confirmación</div>
          <div>
            Confirma el pedido con el cliente antes de despacharlo.
          </div>
        </div>
      )}

      {order.customer_pays_shipping ? (
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
          <span className="text-muted-foreground">Envío</span>
          <span className="font-medium">Cliente paga envío</span>
        </div>
      ) : (
        Number(order.shipping_cost) > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">Costo de envío</span>
            <span className="tabular-nums font-medium">{currency(Number(order.shipping_cost))}</span>
          </div>
        )
      )}

      {sla.tone === "red" && order.delay_reason && (
        <div className="rounded-lg bg-danger-soft px-2.5 py-2 text-xs text-danger-ink">
          <div className="font-semibold">Motivo del retraso</div>
          <div>{order.delay_reason}</div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3 [&>*]:h-10 sm:[&>*]:h-9">
        <WhatsAppContactButton
          phone={order.customer_phone}
          message={
            isShipped && order.tracking_number
              ? `Hola ${order.customer_name}, tu pedido ${order.order_number} ya fue despachado. Guía Inter Rapidísimo: ${order.tracking_number}`
              : `Hola ${order.customer_name}, te escribo de Beast Club sobre tu pedido ${order.order_number}.`
          }
          label="WhatsApp"
        />
        {pendingConfirmation && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleConfirmOrder}
            disabled={confirmOrder.isPending}
          >
            <ClipboardCheck className="h-4 w-4" />
            {confirmOrder.isPending ? "Guardando..." : "Confirmar pedido"}
          </Button>
        )}
        <Button
          size="sm"
          variant={isDispatched ? "outline" : "brand"}
          className="gap-1.5"
          onClick={onShip}
          disabled={pendingConfirmation}
          title={
            pendingConfirmation ? "Confirma el pedido con el cliente primero" : undefined
          }
        >
          {isDispatched ? (
            <>
              <Hash className="h-4 w-4" />
              {missingTracking ? "Registrar guía" : "Editar guía"}
            </>
          ) : (
            <>
              <Truck className="h-4 w-4" />
              Despachar
            </>
          )}
        </Button>
        {isShipped && (
          <Button
            size="sm"
            variant="default"
            className="gap-1.5"
            onClick={handleDelivered}
            disabled={markDelivered.isPending}
          >
            <PackageCheck className="h-4 w-4" />
            {markDelivered.isPending ? "Guardando..." : "Entregado"}
          </Button>
        )}
      </div>
    </Card>
  );
}
