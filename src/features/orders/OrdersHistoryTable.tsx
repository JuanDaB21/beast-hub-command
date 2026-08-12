import { ReactNode, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STATUS_LABEL, statusTone } from "./status";
import type { OrderWithItems } from "./api";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const PAGE_SIZE = 25;

interface Props {
  orders: OrderWithItems[];
  renderDetails: (order: OrderWithItems) => ReactNode;
}

/**
 * Tabla paginada para pedidos en estados terminales (entregado/cancelado). Reemplaza
 * las tarjetas del tablero para estos estados, que crecen sin límite. La paginación es
 * de render (los datos ya vienen completos de useOrders); una fila abre el detalle.
 */
export function OrdersHistoryTable({ orders, renderDetails }: Props) {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = useMemo(
    () => orders.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [orders, safePage],
  );

  // Refresca el detalle abierto con la copia viva de la lista (tras cambios de estado).
  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null;

  if (orders.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Sin pedidos en el historial.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => (
              <TableRow
                key={o.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(o.id)}
              >
                <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                <TableCell className="max-w-[200px] truncate">{o.customer_name}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString("es-MX")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency(Number(o.total))}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={statusTone(o.status)} label={STATUS_LABEL[o.status]} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(o.id);
                    }}
                  >
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          {orders.length} pedido(s) · página {safePage + 1} de {pageCount}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden">
            <DrawerHeader className="shrink-0">
              <DrawerTitle>{selected ? `Pedido ${selected.order_number}` : ""}</DrawerTitle>
              <DrawerDescription>{selected?.customer_name}</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
              {selected && renderDetails(selected)}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
