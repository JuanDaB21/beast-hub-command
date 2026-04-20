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
  useCategories,
  useSubcategories,
  useSuppliers,
  useUpdateRawMaterialsGroup,
} from "@/features/sourcing/api";
import type { MaterialGroup } from "@/features/sourcing/MaterialGroupCard";

interface Props {
  group: MaterialGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditGroupDialog({ group, open, onOpenChange }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: categories = [] } = useCategories();
  const update = useUpdateRawMaterialsGroup();

  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [unitPrice, setUnitPrice] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("unit");

  const { data: subcategories = [] } = useSubcategories(categoryId);

  useEffect(() => {
    if (group && open) {
      setName(group.baseName);
      setSupplierId(group.supplier?.id ?? null);
      setCategoryId(group.category?.id ?? null);
      setSubcategoryId(group.subcategory?.id ?? null);
      const first = group.variants[0];
      setUnitPrice(first ? String(first.unit_price) : "");
      setUnitOfMeasure(first?.unit_of_measure ?? "unit");
    }
  }, [group, open]);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers],
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );
  const subcategoryOptions = useMemo(
    () => subcategories.map((s) => ({ value: s.id, label: s.name })),
    [subcategories],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!supplierId || !categoryId) {
      toast.error("Proveedor y categoría son obligatorios");
      return;
    }

    const renamed = name.trim() !== group.baseName;
    const suffixById: Record<string, string> = {};
    group.variants.forEach((v) => {
      suffixById[v.id] = [v.color?.name, v.size?.label].filter(Boolean).join(" - ");
    });

    try {
      await update.mutateAsync({
        ids: group.variants.map((v) => v.id),
        oldBaseName: group.baseName,
        newBaseName: renamed ? name.trim() : undefined,
        suffixById,
        shared: {
          supplier_id: supplierId,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          unit_price: Number(unitPrice) || 0,
          unit_of_measure: unitOfMeasure.trim() || "unit",
        },
      });
      toast.success(`Se actualizaron ${group.variants.length} variantes`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al actualizar el grupo");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar base padre</DialogTitle>
          <DialogDescription>
            Los cambios se aplican a las {group?.variants.length ?? 0} variantes del grupo.
            El color y la talla de cada variante se conservan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Nombre principal</Label>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <StandardCombobox
              value={supplierId}
              onChange={setSupplierId}
              options={supplierOptions}
              placeholder="Selecciona proveedor"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <StandardCombobox
                value={categoryId}
                onChange={(v) => {
                  setCategoryId(v);
                  setSubcategoryId(null);
                }}
                options={categoryOptions}
                placeholder="Selecciona categoría"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <StandardCombobox
                value={subcategoryId}
                onChange={setSubcategoryId}
                options={subcategoryOptions}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-price">Precio</Label>
              <Input
                id="g-price"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-uom">Unidad</Label>
              <Input
                id="g-uom"
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Guardando..." : "Aplicar a todas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
