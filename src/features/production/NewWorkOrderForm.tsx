import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useProducts } from "@/features/inventory/api";
import { useCreateWorkOrder } from "./api";
import { ProductionRequirementsSummary } from "./RequirementsSummary";
import { Label as UILabel } from "@/components/ui/label";
import { toast } from "sonner";

interface DraftItem {
  product_id: string | null;
  quantity_to_produce: number;
}

interface Props {
  onCreated?: () => void;
}

export function NewWorkOrderForm({ onCreated }: Props) {
  const { data: products = [] } = useProducts();
  const create = useCreateWorkOrder();

  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ product_id: null, quantity_to_produce: 1 }]);

  const productOptions = products
    .filter((p) => p.active)
    .map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }));

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, { product_id: null, quantity_to_produce: 1 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = items.filter((it) => it.product_id && it.quantity_to_produce > 0);
    if (!valid.length) {
      toast.error("Agrega al menos un producto con cantidad válida");
      return;
    }
    try {
      await create.mutateAsync({
        notes: notes.trim() || null,
        target_date: targetDate || null,
        items: valid.map((it) => ({
          product_id: it.product_id!,
          quantity_to_produce: it.quantity_to_produce,
        })),
      });
      toast.success("Lote creado");
      onCreated?.();
    } catch (err) {
      toast.error("Error al crear el lote", { description: (err as Error).message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="target_date">Fecha objetivo</Label>
          <Input
            id="target_date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Productos a producir</Label>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2 p-2 border rounded-md min-w-0">
              <div className="flex-1 min-w-0">
                <StandardCombobox
                  options={productOptions}
                  value={it.product_id}
                  onChange={(v) => updateItem(idx, { product_id: v })}
                  placeholder="Producto"
                  searchPlaceholder="Buscar SKU o nombre..."
                />
              </div>
              <div className="w-full sm:w-32">
                <Input
                  type="number"
                  min={1}
                  value={it.quantity_to_produce}
                  onChange={(e) =>
                    updateItem(idx, { quantity_to_produce: parseInt(e.target.value) || 0 })
                  }
                  placeholder="Cantidad"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                aria-label="Eliminar línea"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <UILabel>Componentes necesarios</UILabel>
        <ProductionRequirementsSummary
          items={items}
          productLabels={Object.fromEntries(
            products.map((p) => [p.id, `${p.sku} · ${p.name}`]),
          )}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Crear lote
        </Button>
      </div>
    </form>
  );
}
