import { EntityDetailCard } from "@/components/shared/EntityDetailCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { ORDER_STATUSES, type OrderStatus, type OrderWithItems } from "./api";
import { STATUS_LABEL, statusTone } from "./status";
import { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  orders: OrderWithItems[];
  renderDetails: (order: OrderWithItems) => ReactNode;
  onChangeStatus?: (id: string, status: OrderStatus) => void;
  onRequestShip?: (order: OrderWithItems, targetStatus: "shipped" | "delivered") => void;
}

/** Board Kanban agrupado por status, con drag & drop entre columnas. */
export function OrdersBoard({ orders, renderDetails, onChangeStatus, onRequestShip }: Props) {
  const groups = ORDER_STATUSES.map((s) => ({
    status: s.value,
    label: s.label,
    items: orders.filter((o) => o.status === s.value),
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const order = active.data.current?.order as OrderWithItems | undefined;
    const target = over.id as OrderStatus;
    if (!order || order.status === target) return;

    if ((target === "shipped" || target === "delivered") && !order.tracking_number) {
      onRequestShip?.(order, target);
      return;
    }
    onChangeStatus?.(order.id, target);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {groups.map((g) => (
          <DroppableColumn key={g.status} status={g.status} label={g.label} count={g.items.length}>
            {g.items.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Sin pedidos
              </div>
            ) : (
              g.items.map((o) => (
                <DraggableOrderCard key={o.id} order={o} renderDetails={renderDetails} />
              ))
            )}
          </DroppableColumn>
        ))}
      </div>
    </DndContext>
  );
}

function DroppableColumn({
  status,
  label,
  count,
  children,
}: {
  status: OrderStatus;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[120px] flex-col rounded-md bg-muted/30 p-2 transition-shadow",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <StatusBadge tone={statusTone(status)} label={label} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DraggableOrderCard({
  order,
  renderDetails,
}: {
  order: OrderWithItems;
  renderDetails: (order: OrderWithItems) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: order.id,
    data: { order },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("touch-none", isDragging && "opacity-50")}
    >
      <OrderCard order={order} renderDetails={renderDetails} />
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
          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
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
