import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search } from "lucide-react";
import {
  useConfirmCod,
  useDeleteOrder,
  useOrders,
  useUpdateOrderStatus,
  type OrderStatus,
  type OrderWithItems,
} from "@/features/orders/api";
import { NewOrderForm } from "@/features/orders/NewOrderForm";
import { OrdersBoard } from "@/features/orders/OrdersBoard";
import { OrderDetails } from "@/features/orders/OrderDetails";
import { ShipDialog } from "@/features/logistics/ShipDialog";
import type { ShipmentOrder } from "@/features/logistics/api";
import { toast } from "@/hooks/use-toast";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default function Orders() {
  const { data: orders = [], isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const confirmCod = useConfirmCod();
  const del = useDeleteOrder();

  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OrderWithItems | null>(null);
  const [shipTarget, setShipTarget] = useState<{
    order: OrderWithItems;
    targetStatus: "shipped" | "delivered";
  } | null>(null);

  const handleChangeStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({ title: "Estado actualizado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    const v = filter.trim().toLowerCase();
    if (!v) return orders;
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(v) ||
        o.customer_name.toLowerCase().includes(v) ||
        o.customer_phone.toLowerCase().includes(v),
    );
  }, [orders, filter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const codPending = orders.filter((o) => o.is_cod && !o.cod_confirmed).length;
    const revenue = orders
      .filter((o) => o.status === "delivered")
      .reduce((acc, o) => acc + Number(o.total), 0);
    return { total, pending, codPending, revenue };
  }, [orders]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast({ title: "Pedido eliminado" });
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setConfirmDelete(null);
    }
  };

  const headerActions = (
    <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Nuevo pedido</span>
    </Button>
  );

  return (
    <AppShell
      title="Módulo 2 · Órdenes"
      description="OMS omnicanal — pedidos manuales (WhatsApp) y Shopify."
      actions={headerActions}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Pedidos totales" value={String(stats.total)} />
        <KPI label="Pendientes" value={String(stats.pending)} tone="yellow" />
        <KPI label="COD por confirmar" value={String(stats.codPending)} tone="red" />
        <KPI label="Ingresos entregados" value={currency(stats.revenue)} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por # pedido, cliente o teléfono..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <OrdersBoard
          orders={filtered}
          renderDetails={(o) => (
            <OrderDetails
              order={o}
              onChangeStatus={(status) =>
                updateStatus
                  .mutateAsync({ id: o.id, status })
                  .then(() => toast({ title: "Estado actualizado" }))
                  .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
              }
              onConfirmCod={(confirmed) =>
                confirmCod
                  .mutateAsync({ id: o.id, confirmed })
                  .then(() => toast({ title: confirmed ? "COD confirmado" : "COD desmarcado" }))
                  .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
              }
              onDelete={() => setConfirmDelete(o)}
            />
          )}
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo pedido manual</DialogTitle>
            <DialogDescription>
              Registra los datos del cliente y agrega productos del catálogo.
            </DialogDescription>
          </DialogHeader>
          <NewOrderForm onSuccess={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar el pedido <strong>{confirmDelete?.order_number}</strong>. También se
              borrarán sus líneas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "red" | "yellow" }) {
  const toneClass =
    tone === "red"
      ? "text-status-red"
      : tone === "yellow"
        ? "text-status-yellow"
        : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${toneClass}`}>{value}</div>
    </Card>
  );
}
