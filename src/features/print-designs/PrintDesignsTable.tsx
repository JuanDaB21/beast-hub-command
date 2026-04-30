import { useState } from "react";
import { Palette, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
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
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { toast } from "sonner";
import { useRawMaterials } from "@/features/sourcing/api";
import {
  usePrintDesigns,
  useCreatePrintDesign,
  useUpdatePrintDesign,
  useDeletePrintDesign,
  type PrintDesign,
  type PrintDesignInput,
} from "./api";

const EMPTY: PrintDesignInput = {
  name: "",
  hex_code: "#000000",
  ink_raw_material_id: null,
  ink_grams_per_cm: 0.5,
  active: true,
};

function DesignDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: (PrintDesign & { editing: true }) | null;
}) {
  const [form, setForm] = useState<PrintDesignInput>(
    initial ? { ...initial } : { ...EMPTY }
  );

  const { data: rawMaterials = [] } = useRawMaterials();
  const create = useCreatePrintDesign();
  const update = useUpdatePrintDesign();
  const pending = create.isPending || update.isPending;

  const inkOptions = rawMaterials.map((r) => ({
    value: r.id,
    label: `${r.name}${r.sku ? ` (${r.sku})` : ""} · ${r.unit_of_measure}`,
  }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...form });
        toast.success("Estampado actualizado");
      } else {
        await create.mutateAsync(form);
        toast.success("Estampado creado");
      }
      onClose();
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  const set = <K extends keyof PrintDesignInput>(k: K, v: PrintDesignInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar estampado" : "Nuevo estampado"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              placeholder="Logo Beast Negro"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color del estampado</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.hex_code}
                onChange={(e) => set("hex_code", e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border border-input bg-background p-1"
              />
              <Input
                value={form.hex_code}
                onChange={(e) => set("hex_code", e.target.value)}
                placeholder="#000000"
                className="font-mono w-32"
                maxLength={7}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Materia prima de tinta</Label>
            <StandardCombobox
              options={inkOptions}
              value={form.ink_raw_material_id ?? null}
              onChange={(v) => set("ink_raw_material_id", v)}
              placeholder="Sin tinta asociada"
              searchPlaceholder="Buscar materia prima..."
            />
            <p className="text-xs text-muted-foreground">
              Al crear variantes se creará automáticamente una fila de BOM para esta tinta.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>
              Consumo de tinta (g/cm de alto)
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.ink_grams_per_cm}
              onChange={(e) =>
                set("ink_grams_per_cm", parseFloat(e.target.value) || 0)
              }
              className="w-32"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Activo</Label>
            <Switch
              checked={form.active}
              onCheckedChange={(v) => set("active", v)}
            />
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

export function PrintDesignsTable() {
  const { data: designs = [], isLoading } = usePrintDesigns();
  const remove = useDeletePrintDesign();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<(PrintDesign & { editing: true }) | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (d: PrintDesign) => {
    setEditing({ ...d, editing: true });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Las variantes con este estampado quedarán sin FK.`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Estampado eliminado");
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Catálogo de Estampados</h2>
          <p className="text-xs text-muted-foreground">
            Cada entrada combina diseño + color. Se usan al crear variantes de producto y generan BOM de tinta automáticamente.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo estampado
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : designs.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <Palette className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay estampados. Crea el primero para asociarlo a las variantes de producto.
          </p>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Crear estampado
          </Button>
        </Card>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Color</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Tinta RM</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">g/cm</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {designs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-5 w-5 rounded-full border border-border"
                        style={{ backgroundColor: d.hex_code }}
                      />
                      <span className="font-mono text-xs text-muted-foreground">{d.hex_code}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                    {d.ink_raw_material?.name ?? <span className="italic text-xs">Sin tinta</span>}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell tabular-nums">
                    {d.ink_raw_material ? d.ink_grams_per_cm : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {d.active ? (
                      <Badge variant="outline" className="bg-status-green/15 text-status-green border-status-green/30 text-xs">Activo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(d)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(d.id, d.name)}
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

      <DesignDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing}
      />
    </div>
  );
}
