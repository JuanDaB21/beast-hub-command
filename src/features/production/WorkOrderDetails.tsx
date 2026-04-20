import { useState } from "react";
import { CheckCircle2, Loader2, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  useCompleteWorkOrder,
  useDeleteWorkOrder,
  useUpdateWorkOrderStatus,
  type WorkOrderWithItems,
} from "./api";
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
            <li key={it.id} className="flex items-center justify-between p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{it.product?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{it.product?.sku ?? ""}</p>
              </div>
              <p className="tabular-nums font-medium">×{it.quantity_to_produce}</p>
            </li>
          ))}
        </ul>
      </div>

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
