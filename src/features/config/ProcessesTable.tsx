import { useState } from "react";
import { Loader2, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useProductionProcesses,
  useCreateProductionProcess,
  useUpdateProductionProcess,
  useDeleteProductionProcess,
  type ProductionProcess,
  type ProductionProcessInput,
} from "@/features/production-processes/api";

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const EMPTY: ProductionProcessInput = { name: "", cost: 0, active: true };

function ProcessDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: (ProductionProcess & { editing: true }) | null;
}) {
  const [form, setForm] = useState<ProductionProcessInput>(initial ? { ...initial } : { ...EMPTY });
  const create = useCreateProductionProcess();
  const update = useUpdateProductionProcess();
  const pending = create.isPending || update.isPending;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...form });
        toast.success("Proceso actualizado");
      } else {
        await create.mutateAsync(form);
        toast.success("Proceso creado");
      }
      onClose();
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar proceso" : "Nuevo proceso"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              placeholder="Corte de mangas"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Costo (COP)</Label>
            <Input
              type="number"
              min={0}
              step={100}
              value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: parseFloat(e.target.value) || 0 }))}
              className="w-40"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Activo</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProcessesTable() {
  const { data: processes = [], isLoading } = useProductionProcesses();
  const remove = useDeleteProductionProcess();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<(ProductionProcess & { editing: true }) | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: ProductionProcess) => {
    setEditing({ ...p, editing: true });
    setDialogOpen(true);
  };
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el proceso "${name}"?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Proceso eliminado");
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Procesos de producción</h2>
          <p className="text-xs text-muted-foreground">
            Pasos adicionales (ej. corte de mangas). Se asignan por producto y aparecen como
            checklist en las órdenes de trabajo; su costo suma a la rentabilidad.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo proceso
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : processes.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <Scissors className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay procesos. Crea el primero para asignarlo a productos.
          </p>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Crear proceso
          </Button>
        </Card>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-right px-3 py-2">Costo</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {processes.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{COP(Number(p.cost))}</td>
                  <td className="px-3 py-2">
                    {p.active ? (
                      <Badge variant="outline" className="bg-status-green/15 text-status-green border-status-green/30 text-xs">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Inactivo
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)} aria-label="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={remove.isPending}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProcessDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />
    </div>
  );
}
