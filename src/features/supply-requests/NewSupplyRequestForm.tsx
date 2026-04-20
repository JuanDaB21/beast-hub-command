import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useSuppliers, useRawMaterials } from "@/features/sourcing/api";
import { useCreateSupplyRequest } from "./api";
import { toast } from "sonner";

interface DraftItem {
  raw_material_id: string | null;
  quantity_requested: string;
}

interface Props {
  onCreated?: (id: string) => void;
}

export function NewSupplyRequestForm({ onCreated }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: materials = [] } = useRawMaterials();
  const create = useCreateSupplyRequest();

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ raw_material_id: null, quantity_requested: "1" }]);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers],
  );

  // Materiales filtrados por proveedor seleccionado (si aplica)
  const materialOptions = useMemo(() => {
    const list = supplierId ? materials.filter((m) => m.supplier_id === supplierId) : materials;
    return list.map((m) => ({
      value: m.id,
      label: `${m.name}${m.sku ? ` · ${m.sku}` : ""} (${m.unit_of_measure})`,
    }));
  }, [materials, supplierId]);

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () =>
    setItems((prev) => [...prev, { raw_material_id: null, quantity_requested: "1" }]);

  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    const cleanItems = items
      .filter((it) => it.raw_material_id)
      .map((it) => ({
        raw_material_id: it.raw_material_id!,
        quantity_requested: Math.max(0, Number(it.quantity_requested) || 0),
      }))
      .filter((it) => it.quantity_requested > 0);

    if (!cleanItems.length) {
      toast.error("Agrega al menos una base con cantidad");
      return;
    }

    try {
      const req = await create.mutateAsync({
        supplier_id: supplierId,
        notes: notes.trim() || null,
        items: cleanItems,
      });
      toast.success("Solicitud creada", { description: "Comparte la URL con el proveedor." });
      setSupplierId(null);
      setNotes("");
      setItems([{ raw_material_id: null, quantity_requested: "1" }]);
      onCreated?.(req.id);
    } catch (err) {
      toast.error("No se pudo crear la solicitud", { description: (err as Error).message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Proveedor</Label>
        <StandardCombobox
          options={supplierOptions}
          value={supplierId}
          onChange={(v) => {
            setSupplierId(v);
            // limpiar items si cambia el proveedor (las bases pueden no aplicar)
            setItems([{ raw_material_id: null, quantity_requested: "1" }]);
          }}
          placeholder="Selecciona un proveedor"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Bases solicitadas</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end rounded-md border p-2"
            >
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">Base</Label>
                <StandardCombobox
                  options={materialOptions}
                  value={it.raw_material_id}
                  onChange={(v) => updateItem(idx, { raw_material_id: v })}
                  placeholder={supplierId ? "Selecciona base" : "Primero elige proveedor"}
                  disabled={!supplierId}
                />
              </div>
              <div className="w-full sm:w-28">
                <Label className="text-xs text-muted-foreground">Cantidad</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={it.quantity_requested}
                  onChange={(e) => updateItem(idx, { quantity_requested: e.target.value })}
                  inputMode="decimal"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                aria-label="Quitar base"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notas (opcional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones para el proveedor"
          rows={2}
        />
      </div>

      <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
        {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Crear solicitud
      </Button>
    </form>
  );
}
