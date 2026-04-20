import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { Plus, X } from "lucide-react";
import {
  useCategories,
  useColors,
  useCreateCategory,
  useCreateRawMaterial,
  useCreateSubcategory,
  useSizes,
  useSubcategories,
  useSuppliers,
} from "./api";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSuccess?: () => void;
}

export function RawMaterialForm({ onSuccess }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: categories = [] } = useCategories();
  const { data: colors = [] } = useColors();
  const { data: sizes = [] } = useSizes();

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("unit");
  const [stock, setStock] = useState("0");

  const { data: subcategories = [] } = useSubcategories(categoryId);

  const create = useCreateRawMaterial();
  const createCategory = useCreateCategory();
  const createSubcategory = useCreateSubcategory();

  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);

  const handleCreateCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    try {
      const cat = await createCategory.mutateAsync(name);
      setCategoryId(cat.id);
      setSubcategoryId(null);
      setNewCategory("");
      setShowNewCategory(false);
      toast({ title: "Categoría creada", description: cat.name });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateSubcategory = async () => {
    const name = newSubcategory.trim();
    if (!name || !categoryId) return;
    try {
      const sub = await createSubcategory.mutateAsync({ name, category_id: categoryId });
      setSubcategoryId(sub.id);
      setNewSubcategory("");
      setShowNewSubcategory(false);
      toast({ title: "Subcategoría creada", description: sub.name });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

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
  const colorOptions = useMemo(() => colors.map((c) => ({ value: c.id, label: c.name })), [colors]);
  const sizeOptions = useMemo(() => sizes.map((s) => ({ value: s.id, label: s.label })), [sizes]);

  const reset = () => {
    setSupplierId(null);
    setCategoryId(null);
    setSubcategoryId(null);
    setColorId(null);
    setSizeId(null);
    setName("");
    setSku("");
    setUnitPrice("");
    setUnitOfMeasure("unit");
    setStock("0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !categoryId || !unitPrice) {
      toast({
        title: "Faltan datos",
        description: "Proveedor, categoría y precio son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    const category = categories.find((c) => c.id === categoryId);
    const subcategory = subcategories.find((s) => s.id === subcategoryId);
    const color = colors.find((c) => c.id === colorId);
    const size = sizes.find((s) => s.id === sizeId);
    const generatedName =
      [category?.name, subcategory?.name, color?.name, size?.label].filter(Boolean).join(" · ") ||
      category?.name ||
      "Insumo";
    try {
      await create.mutateAsync({
        supplier_id: supplierId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        color_id: colorId,
        size_id: sizeId,
        sku: sku.trim() || null,
        name: generatedName,
        unit_price: Number(unitPrice),
        unit_of_measure: unitOfMeasure || "unit",
        stock: Number(stock) || 0,
      });
      toast({ title: "Insumo creado", description: generatedName });
      reset();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error al crear", description: err.message, variant: "destructive" });
    }
  };

  if (suppliers.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Primero crea al menos un proveedor para poder registrar insumos.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Proveedor *</Label>
        <StandardCombobox
          options={supplierOptions}
          value={supplierId}
          onChange={setSupplierId}
          placeholder="Seleccionar proveedor"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Categoría *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => setShowNewCategory((v) => !v)}
            >
              {showNewCategory ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showNewCategory ? "Cancelar" : "Nueva"}
            </Button>
          </div>
          {showNewCategory ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nombre de categoría"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreateCategory}
                disabled={createCategory.isPending || !newCategory.trim()}
              >
                {createCategory.isPending ? "..." : "Crear"}
              </Button>
            </div>
          ) : (
            <StandardCombobox
              options={categoryOptions}
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                setSubcategoryId(null);
              }}
              placeholder="Seleccionar categoría"
            />
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Subcategoría</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              disabled={!categoryId}
              onClick={() => setShowNewSubcategory((v) => !v)}
            >
              {showNewSubcategory ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showNewSubcategory ? "Cancelar" : "Nueva"}
            </Button>
          </div>
          {showNewSubcategory ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={newSubcategory}
                onChange={(e) => setNewSubcategory(e.target.value)}
                placeholder="Nombre de subcategoría"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateSubcategory();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreateSubcategory}
                disabled={createSubcategory.isPending || !newSubcategory.trim() || !categoryId}
              >
                {createSubcategory.isPending ? "..." : "Crear"}
              </Button>
            </div>
          ) : (
            <StandardCombobox
              options={subcategoryOptions}
              value={subcategoryId}
              onChange={setSubcategoryId}
              placeholder={categoryId ? "Seleccionar subcategoría" : "Elige categoría primero"}
              disabled={!categoryId}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Color</Label>
          <StandardCombobox options={colorOptions} value={colorId} onChange={setColorId} placeholder="Sin color" />
        </div>
        <div className="space-y-1.5">
          <Label>Talla</Label>
          <StandardCombobox options={sizeOptions} value={sizeId} onChange={setSizeId} placeholder="Sin talla" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="rm-sku">SKU</Label>
          <Input id="rm-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rm-price">Precio unitario *</Label>
          <Input
            id="rm-price"
            type="number"
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rm-uom">Unidad</Label>
          <Input
            id="rm-uom"
            value={unitOfMeasure}
            onChange={(e) => setUnitOfMeasure(e.target.value)}
            placeholder="unit, m, kg..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rm-stock">Stock inicial</Label>
          <Input
            id="rm-stock"
            type="number"
            step="0.01"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
        {create.isPending ? "Guardando..." : "Crear insumo"}
      </Button>
    </form>
  );
}
