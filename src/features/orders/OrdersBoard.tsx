import { EntityDetailCard } from "@/components/shared/EntityDetailCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { BOARD_STATUSES, countGarments, requiresTracking, type OrderStatus, type OrderWithItems } from "./api";
import { STATUS_LABEL, statusTone } from "./status";
import { ReactNode, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowRightLeft, Inbox, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCOP, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  orders: OrderWithItems[];
  renderDetails: (order: OrderWithItems) => ReactNode;
  onChangeStatus?: (id: string, status: OrderStatus) => void;
  onRequestShip?: (order: OrderWithItems, targetStatus: "shipped" | "delivered") => void;
}

/**
 * Kanban por estado. Desktop: columnas con drag & drop (mouse, o toque largo en
 * tablet). Móvil: una columna a la vez, elegida con pestañas; el cambio de
 * estado se hace con "Mover a" en cada tarjeta.
 */
export function OrdersBoard({ orders, renderDetails, onChangeStatus, onRequestShip }: Props) {
  const groups = BOARD_STATUSES.map((s) => ({
    status: s.value,
    label: s.label,
    items: orders.filter((o) => o.status === s.value),
  }));
  const [mobileLane, setMobileLane] = useState<OrderStatus>(groups[0]?.status ?? "pending");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const moveTo = (order: OrderWithItems, target: OrderStatus) => {
    if (order.status === target) return;
    if (requiresTracking(target, order.tracking_number)) {
      onRequestShip?.(order, target);
      return;
    }
    onChangeStatus?.(order.id, target);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const order = active.data.current?.order as OrderWithItems | undefined;
    if (order) moveTo(order, over.id as OrderStatus);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Selector de columna (móvil) */}
      <div
        role="tablist"
        aria-label="Estado"
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-3 flex gap-2 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur-md scrollbar-none md:hidden"
      >
        {groups.map((g) => {
          const active = g.status === mobileLane;
          return (
            <button
              key={g.status}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMobileLane(g.status)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-fast",
                active ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground",
              )}
            >
              {g.label}
              <span
                className={cn(
                  "tabular font-display text-base font-semibold leading-none",
                  active ? "text-brand" : "text-foreground",
                )}
              >
                {g.items.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <DroppableColumn
            key={g.status}
            status={g.status}
            label={g.label}
            count={g.items.length}
            className={cn(g.status !== mobileLane && "hidden md:flex")}
          >
            {g.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                <Inbox className="h-5 w-5" />
                Sin pedidos en esta columna
              </div>
            ) : (
              g.items.map((o) => (
                <DraggableOrderCard key={o.id} order={o} renderDetails={renderDetails} onMove={moveTo} />
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
  className,
  children,
}: {
  status: OrderStatus;
  label: string;
  count: number;
  className?: string;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex min-h-[160px] flex-col rounded-xl transition-colors duration-base ease-out-quint md:bg-surface-3/50 md:p-2.5",
        isOver && "bg-brand-soft ring-2 ring-brand/50",
        className,
      )}
    >
      <header className="mb-2.5 hidden items-center justify-between px-1 md:flex">
        <StatusBadge tone={statusTone(status)} label={label} />
        <span className="tabular font-display text-xl font-semibold leading-none">{count}</span>
      </header>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function DraggableOrderCard({
  order,
  renderDetails,
  onMove,
}: {
  order: OrderWithItems;
  renderDetails: (order: OrderWithItems) => ReactNode;
  onMove: (order: OrderWithItems, target: OrderStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: order.id,
    data: { order },
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("touch-manipulation", isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      <OrderCard order={order} renderDetails={renderDetails} onMove={onMove} />
    </div>
  );
}

// Evita que los controles internos abran el detalle o inicien un arrastre.
const stopEvents = {
  onClick: (e: React.SyntheticEvent) => e.stopPropagation(),
  onPointerDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(),
  onKeyDown: (e: React.SyntheticEvent) => e.stopPropagation(),
};

function OrderCard({
  order,
  renderDetails,
  onMove,
}: {
  order: OrderWithItems;
  renderDetails: (order: OrderWithItems) => ReactNode;
  onMove: (order: OrderWithItems, target: OrderStatus) => void;
}) {
  const garments = countGarments(order.items);
  // Mismos destinos que el arrastre; entregar/cancelar se hace desde el detalle.
  const targets = BOARD_STATUSES.filter((s) => s.value !== order.status);

  return (
    <EntityDetailCard
      title={order.customer_name}
      subtitle={order.order_number}
      detailsTitle={`Pedido ${order.order_number}`}
      detailsDescription={order.customer_name}
      summary={
        <div className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5 text-xs">
              {order.customer_city && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {order.customer_city}
                </span>
              )}
              <span>
                {garments} prenda{garments === 1 ? "" : "s"}, {timeAgo(order.created_at)}
              </span>
            </div>
            <span className="tabular shrink-0 font-display text-xl font-semibold leading-none text-foreground">
              {formatCOP(order.total)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-2xs font-medium capitalize text-secondary-foreground">
              {order.source}
            </span>
            {order.is_cod && (
              <StatusBadge
                tone={order.cod_confirmed ? "green" : "yellow"}
                label={order.cod_confirmed ? "COD cobrado" : "Contraentrega"}
              />
            )}
            {!order.is_cod && order.payment_status === "pending_verification" && (
              <StatusBadge tone="red" label="Pago por verificar" />
            )}
          </div>
          <div className="-mx-1 flex items-center justify-between border-t pt-1.5" {...stopEvents}>
            <WhatsAppContactButton
              phone={order.customer_phone}
              message={`Hola ${order.customer_name}, te contacto sobre tu pedido ${order.order_number}.`}
              size="sm"
              variant="ghost"
              className="h-9 px-2 text-xs"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Mover a
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Ahora: {STATUS_LABEL[order.status]}
                </DropdownMenuLabel>
                {targets.map((s) => (
                  <DropdownMenuItem key={s.value} onSelect={() => onMove(order, s.value)} className="h-10">
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
