import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RawMaterialWithRelations,
  useUpdateRawMaterial,
} from "@/features/sourcing/api";

interface Props {
  material: RawMaterialWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRawMaterialDialog({ material, open, onOpenChange }: Props) {
  const update = useUpdateRawMaterial();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [unitOfMeasure, setUnitOfMeasure] = useState("unit");
  const [stock, setStock] = useState("0");

  useEffect(() => {
    if (material) {
      setName(material.name);
      setSku(material.sku ?? "");
      setUnitPrice(String(material.unit_price));
      setUnitOfMeasure(material.unit_of_measure);
      setStock(String(material.stock));
    }
  }, [material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material) return;
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      await update.mutateAsync({
        id: material.id,
        patch: {
          name: name.trim(),
          sku: sku.trim() || null,
          unit_price: Number(unitPrice) || 0,
          unit_of_measure: unitOfMeasure.trim() || "unit",
          stock: Number(stock) || 0,
        },
      });
      toast.success("Base actualizada");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al actualizar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar base</DialogTitle>
          <DialogDescription>
            Actualiza los datos de esta variante. Para cambiar color/talla, elimínala y vuelve a crearla.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nombre</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-sku">SKU</Label>
            <Input id="edit-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Precio</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-uom">Unidad</Label>
              <Input
                id="edit-uom"
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-stock">Stock</Label>
            <Input
              id="edit-stock"
              type="number"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
