import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  type PrintDesign,
  type PrintDesignInput,
} from "./api";

const EMPTY: PrintDesignInput = {
  name: "",
  hex_code: "#000000",
  ink_raw_material_id: null,
  ink_grams_per_cm: 0.5,
  active: true,
  drive_url: null,
  parent_design_id: null,
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Estampado a editar; null para crear uno nuevo. */
  initial: (PrintDesign & { editing: true }) | null;
  /** Preselecciona un estampado padre al crear un hijo por color. */
  defaultParentId?: string | null;
  /** Se llama con el estampado recién creado (para autoseleccionarlo). */
  onCreated?: (design: PrintDesign) => void;
}

/** Diálogo reutilizable de creación/edición de estampados. */
export function DesignDialog({ open, onClose, initial, defaultParentId, onCreated }: Props) {
  const [form, setForm] = useState<PrintDesignInput>(
    initial
      ? { ...initial }
      : { ...EMPTY, parent_design_id: defaultParentId ?? null },
  );

  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: allDesigns = [] } = usePrintDesigns();
  const create = useCreatePrintDesign();
  const update = useUpdatePrintDesign();
  const pending = create.isPending || update.isPending;

  const inkOptions = rawMaterials.map((r) => ({
    value: r.id,
    label: `${r.name}${r.sku ? ` (${r.sku})` : ""} · ${r.unit_of_measure}`,
  }));

  // Padres posibles: estampados raíz (sin padre) distintos del que se edita.
  const parentOptions = useMemo(
    () =>
      allDesigns
        .filter((d) => !d.parent_design_id && d.id !== initial?.id)
        .map((d) => ({ value: d.id, label: d.name })),
    [allDesigns, initial],
  );

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
        const created = await create.mutateAsync(form);
        toast.success("Estampado creado");
        onCreated?.(created);
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar estampado" : "Nuevo estampado"}</DialogTitle>
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
            <Label>Estampado padre (opcional)</Label>
            <StandardCombobox
              options={parentOptions}
              value={form.parent_design_id ?? null}
              onChange={(v) => set("parent_design_id", v)}
              placeholder="Sin padre (estampado raíz)"
              searchPlaceholder="Buscar estampado padre..."
              emptyText="No hay estampados raíz"
            />
            <p className="text-xs text-muted-foreground">
              Usa un padre para agrupar el mismo diseño en varios colores.
            </p>
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
            <Label>Consumo de tinta (g/cm de alto)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.ink_grams_per_cm}
              onChange={(e) => set("ink_grams_per_cm", parseFloat(e.target.value) || 0)}
              className="w-32"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Link del archivo DTF (Drive)</Label>
            <Input
              type="url"
              placeholder="https://drive.google.com/..."
              value={form.drive_url ?? ""}
              onChange={(e) => set("drive_url", e.target.value || null)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Activo</Label>
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
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
