import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Trash2 } from "lucide-react";
import { KpiCard } from "@/features/bi/KpiCard";
import { OverflowMenu } from "@/components/shared/OverflowMenu";
import { StatStrip } from "@/components/shared/StatStrip";
import {
  BOARD_STATUSES,
  HISTORY_STATUSES,
  useDeleteAllOrders,
  useDeleteOrder,
  useOrders,
  useUpdateOrderStatus,
  type OrderStatus,
  type OrderWithItems,
} from "@/features/orders/api";
import { NewOrderForm } from "@/features/orders/NewOrderForm";
import { OrdersBoard } from "@/features/orders/OrdersBoard";
import { OrdersHistoryTable } from "@/features/orders/OrdersHistoryTable";
import { OrderDetails } from "@/features/orders/OrderDetails";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipDialog } from "@/features/logistics/ShipDialog";

import { toast } from "@/hooks/use-toast";
import { matchesAllTokens } from "@/lib/textSearch";

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const BOARD_SET = new Set(BOARD_STATUSES.map((s) => s.value));
const HISTORY_SET = new Set(HISTORY_STATUSES.map((s) => s.value));

export default function Orders() {
  const { data: orders = [], isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const del = useDeleteOrder();
  const delAll = useDeleteAllOrders();

  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OrderWithItems | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
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
    if (!filter.trim()) return orders;
    return orders.filter((o) =>
      matchesAllTokens(
        `${o.order_number} ${o.customer_name} ${o.customer_phone}`,
        filter,
      ),
    );
  }, [orders, filter]);

  const activeOrders = useMemo(
    () => filtered.filter((o) => BOARD_SET.has(o.status)),
    [filtered],
  );
  const historyOrders = useMemo(
    () => filtered.filter((o) => HISTORY_SET.has(o.status)),
    [filtered],
  );

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === "pending").length;
    // COD que la transportadora todavía no ha cobrado (aún sin entregar).
    const codPending = orders.filter((o) => o.is_cod && !o.cod_confirmed).length;
    const paymentPending = orders.filter(
      (o) => !o.is_cod && o.payment_status === "pending_verification",
    ).length;
    const revenue = orders
      .filter((o) => o.status === "delivered")
      .reduce((acc, o) => acc + Number(o.total), 0);
    return { total, pending, codPending, paymentPending, revenue };
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

  const closeDeleteAll = () => {
    setDeleteAllOpen(false);
    setDeleteAllConfirmText("");
  };

  const handleDeleteAll = async () => {
    try {
      const { deleted } = await delAll.mutateAsync();
      toast({ title: `${deleted} pedidos eliminados` });
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      closeDeleteAll();
    }
  };

  const renderDetails = (o: OrderWithItems) => (
    <OrderDetails
      order={o}
      onChangeStatus={(status) =>
        updateStatus
          .mutateAsync({ id: o.id, status })
          .then(() => toast({ title: "Estado actualizado" }))
          .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      }
      onRequestShip={(targetStatus) => setShipTarget({ order: o, targetStatus })}
      onDelete={() => setConfirmDelete(o)}
    />
  );

  const headerActions = (
    <>
      <Button size="sm" variant="brand" className="gap-1.5" onClick={() => setFormOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo<span className="hidden sm:inline"> pedido</span>
      </Button>
      <OverflowMenu
        items={[
          {
            label: "Eliminar todos los pedidos",
            icon: Trash2,
            destructive: true,
            disabled: orders.length === 0,
            onSelect: () => setDeleteAllOpen(true),
          },
        ]}
      />
    </>
  );

  return (
    <AppShell
      title="Órdenes"
      description="Pedidos manuales (WhatsApp) y de Shopify."
      actions={headerActions}
    >
      <StatStrip cols={5} className="mb-5">
        <KpiCard label="Pendientes" value={String(stats.pending)} tone={stats.pending ? "yellow" : "default"} size="compact" />
        <KpiCard label="Pagos por verificar" value={String(stats.paymentPending)} tone={stats.paymentPending ? "red" : "default"} size="compact" />
        <KpiCard label="COD por cobrar" value={String(stats.codPending)} tone={stats.codPending ? "red" : "default"} size="compact" />
        <KpiCard label="Pedidos totales" value={String(stats.total)} size="compact" />
        <KpiCard label="Ingresos entregados" value={currency(stats.revenue)} tone="primary" size="compact" />
      </StatStrip>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="board">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
              <TabsTrigger value="board">Activos ({activeOrders.length})</TabsTrigger>
              <TabsTrigger value="history">Historial ({historyOrders.length})</TabsTrigger>
            </TabsList>
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Pedido, cliente o teléfono"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <TabsContent value="board" className="mt-4">
            <OrdersBoard
              orders={activeOrders}
              onChangeStatus={handleChangeStatus}
              onRequestShip={(order, targetStatus) => setShipTarget({ order, targetStatus })}
              renderDetails={renderDetails}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <OrdersHistoryTable orders={historyOrders} renderDetails={renderDetails} />
          </TabsContent>
        </Tabs>
      )}

      <ShipDialog
        order={shipTarget?.order ?? null}
        open={!!shipTarget}
        onOpenChange={(o) => !o && setShipTarget(null)}
        targetStatus={shipTarget?.targetStatus}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[90vh] sm:w-[95vw] max-w-3xl flex-col overflow-hidden p-0 sm:w-full">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Nuevo pedido manual</DialogTitle>
            <DialogDescription>
              Registra los datos del cliente y agrega productos del catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <NewOrderForm onSuccess={() => setFormOpen(false)} />
          </div>
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

      <AlertDialog open={deleteAllOpen} onOpenChange={(o) => !o && closeDeleteAll()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar TODOS los pedidos</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{orders.length}</strong> pedido(s) junto con sus líneas y
              devoluciones asociadas. Los registros financieros históricos no se borrarán. Esta
              acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Para confirmar, escribe <strong>ELIMINAR</strong> abajo:
            </p>
            <Input
              autoFocus
              value={deleteAllConfirmText}
              onChange={(e) => setDeleteAllConfirmText(e.target.value)}
              placeholder="ELIMINAR"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleteAllConfirmText !== "ELIMINAR" || delAll.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delAll.isPending ? "Eliminando…" : "Eliminar todos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
