import { EntityDetailCard } from "@/components/shared/EntityDetailCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { ORDER_STATUSES, type OrderStatus, type OrderWithItems } from "./api";
import { STATUS_LABEL, statusTone } from "./status";
import { ReactNode } from "react";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  orders: OrderWithItems[];
  renderDetails: (order: OrderWithItems) => ReactNode;
}

/** Board Kanban agrupado por status. */
export function OrdersBoard({ orders, renderDetails }: Props) {
  const groups = ORDER_STATUSES.map((s) => ({
    status: s.value,
    label: s.label,
    items: orders.filter((o) => o.status === s.value),
  }));

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {groups.map((g) => (
        <div key={g.status} className="flex min-h-[120px] flex-col rounded-md bg-muted/30 p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <StatusBadge tone={statusTone(g.status)} label={g.label} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{g.items.length}</span>
          </div>
          <div className="space-y-2">
            {g.items.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Sin pedidos
              </div>
            ) : (
              g.items.map((o) => (
                <OrderCard key={o.id} order={o} renderDetails={renderDetails} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderCard({
  order,
  renderDetails,
}: {
  order: OrderWithItems;
  renderDetails: (order: OrderWithItems) => ReactNode;
}) {
  const codTone = order.cod_confirmed ? "green" : "red";
  return (
    <EntityDetailCard
      title={order.customer_name}
      subtitle={order.order_number}
      detailsTitle={`Pedido ${order.order_number}`}
      detailsDescription={order.customer_name}
      className="bg-card"
      summary={
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary-foreground">
              {order.source}
            </span>
            {order.is_cod && (
              <StatusBadge tone={codTone} label={order.cod_confirmed ? "COD ok" : "COD pend."} />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{order.items.length} ítem(s)</span>
            <span className="font-medium tabular-nums text-foreground">
              {currency(Number(order.total))}
            </span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <WhatsAppContactButton
              phone={order.customer_phone}
              message={`Hola ${order.customer_name}, te contacto sobre tu pedido ${order.order_number}.`}
              size="sm"
              variant="ghost"
              className="-ml-2 h-7 px-2 text-xs"
            />
          </div>
        </div>
      }
      details={renderDetails(order)}
    />
  );
}

// Re-export for convenience
export { STATUS_LABEL };
export type { OrderStatus };
