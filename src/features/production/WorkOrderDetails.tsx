import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { DtfChecklist } from "./DtfChecklist";
import { ComponentsChecklist } from "./ComponentsChecklist";
import {
  useAddWorkOrderItem,
  useCompleteWorkOrder,
  useDeleteWorkOrder,
  useRemoveWorkOrderItem,
  useUpdateWorkOrderItemQty,
  useUpdateWorkOrderStatus,
  type WorkOrderItemRow,
  type WorkOrderWithItems,
} from "./api";
import { useProducts } from "@/features/inventory/api";
import { workOrderLabel, workOrderTone } from "./status";
import { toast } from "sonner";

interface Props {
  wo: WorkOrderWithItems;
  onClose?: () => void;
}

export function WorkOrderDetails({ wo, onClose }: Props) {
  const updateStatus = useUpdateWorkOrderStatus();
  const complete = useCompleteWorkOrder();
  const remove = useDeleteWorkOrder();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const totalUnits = wo.items.reduce((s, it) => s + it.quantity_to_produce, 0);
  const isClosed = wo.status === "completed" || wo.status === "cancelled";

  const handleComplete = async () => {
    try {
      await complete.mutateAsync(wo.id);
      toast.success("Lote completado", {
        description: "Stock de productos sumado y de insumos descontado.",
      });
      setConfirmOpen(false);
      onClose?.();
    } catch (err) {
      toast.error("No se pudo completar el lote", {
        description: (err as Error).message,
      });
    }
  };

  const handleStart = async () => {
    try {
      await updateStatus.mutateAsync({ id: wo.id, status: "in_progress" });
      toast.success("Lote iniciado");
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  const handleCancel = async () => {
    try {
      await updateStatus.mutateAsync({ id: wo.id, status: "cancelled" });
      toast.success("Lote cancelado");
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(wo.id);
      toast.success("Lote eliminado");
      setDeleteOpen(false);
      onClose?.();
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Lote</p>
          <p className="text-lg font-semibold">{wo.batch_number}</p>
        </div>
        <StatusBadge tone={workOrderTone(wo.status)} label={workOrderLabel(wo.status)} />
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="componentes">Componentes</TabsTrigger>
          <TabsTrigger value="dtf">Archivo DTF</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Fecha objetivo</p>
              <p>{wo.target_date ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total unidades</p>
              <p className="tabular-nums">{totalUnits}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Iniciado</p>
              <p>{wo.started_at ? new Date(wo.started_at).toLocaleString() : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completado</p>
              <p>{wo.completed_at ? new Date(wo.completed_at).toLocaleString() : "—"}</p>
            </div>
          </div>

          {wo.notes && (
            <div className="rounded-md bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Notas</p>
              <p>{wo.notes}</p>
            </div>
          )}

          <div className="rounded-md border">
            <div className="p-3 border-b bg-muted/30 text-sm font-medium">Productos del lote</div>
            <ul className="divide-y">
              {wo.items.map((it) => (
                <WorkOrderItemRowView key={it.id} item={it} editable={!isClosed} />
              ))}
            </ul>
            {!isClosed && <AddItemRow workOrderId={wo.id} />}
          </div>
        </TabsContent>

        <TabsContent value="componentes">
          <ComponentsChecklist wo={wo} />
        </TabsContent>

        <TabsContent value="dtf">
          <DtfChecklist wo={wo} />
        </TabsContent>
      </Tabs>

      {!isClosed && (
        <div className="flex flex-wrap gap-2 pt-2">
          {wo.status === "pending" && (
            <Button onClick={handleStart} variant="outline" disabled={updateStatus.isPending}>
              <Play className="h-4 w-4 mr-1" /> Iniciar
            </Button>
          )}
          <Button onClick={() => setConfirmOpen(true)} disabled={complete.isPending}>
            {complete.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Completar lote
          </Button>
          <Button onClick={handleCancel} variant="outline" disabled={updateStatus.isPending}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
        </div>
      )}

      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Eliminar lote
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Completar el lote {wo.batch_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción sumará {totalUnits} unidades al stock de productos y descontará los
              insumos según la receta de cada producto. Si algún insumo no es suficiente, la
              operación se revertirá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>Completar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el lote {wo.batch_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. No afecta el stock si el lote no estaba completado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WorkOrderItemRowView({
  item,
  editable,
}: {
  item: WorkOrderItemRow;
  editable: boolean;
}) {
  const updateQty = useUpdateWorkOrderItemQty();
  const remove = useRemoveWorkOrderItem();
  const [qty, setQty] = useState(String(item.quantity_to_produce));

  const commit = async () => {
    const n = parseInt(qty, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setQty(String(item.quantity_to_produce));
      return;
    }
    if (n === item.quantity_to_produce) return;
    try {
      await updateQty.mutateAsync({ id: item.id, quantity_to_produce: n });
      toast.success("Cantidad actualizada");
    } catch (err) {
      setQty(String(item.quantity_to_produce));
      toast.error("Error", { description: (err as Error).message });
    }
  };

  const handleRemove = async () => {
    try {
      await remove.mutateAsync(item.id);
      toast.success("Producto eliminado del lote");
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  if (!editable) {
    return (
      <li className="flex items-center justify-between p-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium truncate">{item.product?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{item.product?.sku ?? ""}</p>
        </div>
        <p className="tabular-nums font-medium">×{item.quantity_to_produce}</p>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{item.product?.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{item.product?.sku ?? ""}</p>
      </div>
      <Input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={updateQty.isPending}
        className="w-20 text-right tabular-nums"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleRemove}
        disabled={remove.isPending}
        aria-label="Eliminar del lote"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

function AddItemRow({ workOrderId }: { workOrderId: string }) {
  const { data: products = [] } = useProducts();
  const add = useAddWorkOrderItem();
  const [productId, setProductId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  const productOptions = useMemo(
    () =>
      products
        .filter((p) => p.active)
        .map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })),
    [products],
  );

  const handleAdd = async () => {
    if (!productId || qty <= 0) return;
    try {
      await add.mutateAsync({
        work_order_id: workOrderId,
        product_id: productId,
        quantity_to_produce: qty,
      });
      toast.success("Producto agregado");
      setProductId(null);
      setQty(1);
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t bg-muted/20 p-3 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <StandardCombobox
          options={productOptions}
          value={productId}
          onChange={setProductId}
          placeholder="Agregar producto..."
          searchPlaceholder="Buscar SKU o nombre..."
        />
      </div>
      <Input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(parseInt(e.target.value) || 0)}
        className="w-full sm:w-24 text-right tabular-nums"
      />
      <Button
        type="button"
        size="sm"
        onClick={handleAdd}
        disabled={!productId || qty <= 0 || add.isPending}
      >
        {add.isPending ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-1" />
        )}
        Agregar
      </Button>
    </div>
  );
}
