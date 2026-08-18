import { useEffect, useMemo, useState } from "react";
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
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import {
  RawMaterialWithRelations,
  useColors,
  useSizes,
  useUpdateRawMaterial,
} from "@/features/sourcing/api";
import { buildVariantName, extractBaseName } from "@/features/sourcing/groupHelpers";

interface Props {
  material: RawMaterialWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Otras variantes del grupo, para validar color/talla duplicados. */
  siblings?: RawMaterialWithRelations[];
}

export function EditRawMaterialDialog({ material, open, onOpenChange, siblings = [] }: Props) {
  const update = useUpdateRawMaterial();
  const { data: colors = [] } = useColors();
  const { data: sizes = [] } = useSizes();

  const [baseName, setBaseName] = useState("");
  const [colorId, setColorId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [unitOfMeasure, setUnitOfMeasure] = useState("unit");
  const [stock, setStock] = useState("0");

  useEffect(() => {
    if (!material) return;
    setBaseName(extractBaseName(material));
    setColorId(material.color_id);
    setSizeId(material.size_id);
    setSku(material.sku ?? "");
    setUnitPrice(String(material.unit_price));
    setUnitOfMeasure(material.unit_of_measure);
    setStock(String(material.stock));
  }, [material]);

  const colorOptions = useMemo(
    () => colors.map((c) => ({ value: c.id, label: c.name })),
    [colors],
  );
  const sizeOptions = useMemo(
    () => sizes.map((s) => ({ value: s.id, label: s.label })),
    [sizes],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material) return;
    if (!baseName.trim()) {
      toast.error("El nombre base es obligatorio");
      return;
    }

    // Duplicado de color/talla dentro del mismo grupo (excluyendo esta variante).
    const dup = siblings.some(
      (s) => s.id !== material.id && s.color_id === colorId && s.size_id === sizeId,
    );
    if (dup) {
      toast.error("Ya existe una variante con ese color y talla en esta base");
      return;
    }

    const color = colors.find((c) => c.id === colorId) ?? null;
    const size = sizes.find((s) => s.id === sizeId) ?? null;
    const name = buildVariantName(baseName.trim(), color?.name, size?.label);

    try {
      await update.mutateAsync({
        id: material.id,
        patch: {
          name,
          color_id: colorId,
          size_id: sizeId,
          sku: sku.trim() || null,
          unit_price: Number(unitPrice) || 0,
          unit_of_measure: unitOfMeasure.trim() || "unit",
          stock: Number(stock) || 0,
        },
      });
      toast.success("Variante actualizada");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al actualizar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar variante</DialogTitle>
          <DialogDescription>
            Cambia color, talla y demás datos de esta variante. El nombre se recompone como
            «Base - Color - Talla».
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nombre base</Label>
            <Input id="edit-name" value={baseName} onChange={(e) => setBaseName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Color</Label>
              <StandardCombobox
                options={colorOptions}
                value={colorId}
                onChange={setColorId}
                placeholder="Sin color"
                searchPlaceholder="Buscar color..."
                emptyText="Sin colores"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Talla</Label>
              <StandardCombobox
                options={sizeOptions}
                value={sizeId}
                onChange={setSizeId}
                placeholder="Sin talla"
                searchPlaceholder="Buscar talla..."
                emptyText="Sin tallas"
              />
            </div>
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
