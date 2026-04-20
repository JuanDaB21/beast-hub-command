import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { Plus, X, AlertTriangle } from "lucide-react";
import {
  findExistingVariantNames,
  useCategories,
  useColors,
  useCreateCategory,
  useCreateRawMaterialsBatch,
  useCreateSubcategory,
  useSizes,
  useSubcategories,
  useSuppliers,
  type RawMaterialInput,
} from "./api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  onSuccess?: () => void;
}

const sanitizeSku = (s: string) => s.replace(/\s+/g, "").toUpperCase();

export function RawMaterialForm({ onSuccess }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: categories = [] } = useCategories();
  const { data: colors = [] } = useColors();
  const { data: sizes = [] } = useSizes();

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [colorIds, setColorIds] = useState<string[]>([]);
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [skuBase, setSkuBase] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("unit");
  const [stock, setStock] = useState("0");

  const { data: subcategories = [] } = useSubcategories(categoryId);

  const createBatch = useCreateRawMaterialsBatch();
  const createCategory = useCreateCategory();
  const createSubcategory = useCreateSubcategory();

  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);

  const handleCreateCategory = async () => {
    const value = newCategory.trim();
    if (!value) return;
    try {
      const cat = await createCategory.mutateAsync(value);
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
    const value = newSubcategory.trim();
    if (!value || !categoryId) return;
    try {
      const sub = await createSubcategory.mutateAsync({ name: value, category_id: categoryId });
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

  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  // Build variants matrix
  const variants = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return [];
    const cs = colorIds.length > 0 ? colorIds.map((id) => colors.find((c) => c.id === id) ?? null) : [null];
    const ss = sizeIds.length > 0 ? sizeIds.map((id) => sizes.find((s) => s.id === id) ?? null) : [null];
    const out: { name: string; color_id: string | null; size_id: string | null; sku: string | null }[] = [];
    for (const c of cs) {
      for (const s of ss) {
        const variantName = [trimmed, c?.name, s?.label].filter(Boolean).join(" - ");
        const sku = skuBase.trim()
          ? sanitizeSku(`${skuBase}-${c?.name ?? ""}${s?.label ?? ""}`)
          : null;
        out.push({
          name: variantName,
          color_id: c?.id ?? null,
          size_id: s?.id ?? null,
          sku,
        });
      }
    }
    return out;
  }, [name, colorIds, sizeIds, colors, sizes, skuBase]);

  const reset = () => {
    setSupplierId(null);
    setCategoryId(null);
    setSubcategoryId(null);
    setColorIds([]);
    setSizeIds([]);
    setName("");
    setSkuBase("");
    setUnitPrice("");
    setUnitOfMeasure("unit");
    setStock("0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !categoryId || !unitPrice || !name.trim()) {
      toast({
        title: "Faltan datos",
        description: "Proveedor, categoría, nombre y precio son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    if (variants.length === 0) return;

    try {
      const existing = await findExistingVariantNames(
        supplierId,
        categoryId,
        variants.map((v) => v.name),
      );
      const toInsert = variants.filter((v) => !existing.has(v.name));
      const skipped = variants.length - toInsert.length;

      if (toInsert.length === 0) {
        toast({
          title: "Todas las variantes ya existen",
          description: "No se creó ningún registro nuevo.",
          variant: "destructive",
        });
        return;
      }

      const payloads: RawMaterialInput[] = toInsert.map((v) => ({
        supplier_id: supplierId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        color_id: v.color_id,
        size_id: v.size_id,
        sku: v.sku,
        name: v.name,
        unit_price: Number(unitPrice),
        unit_of_measure: unitOfMeasure || "unit",
        stock: Number(stock) || 0,
      }));

      await createBatch.mutateAsync(payloads);
      toast({
        title: `${toInsert.length} variante(s) creada(s)`,
        description: skipped > 0 ? `${skipped} omitida(s) por duplicado.` : "Listas para producción.",
      });
      reset();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error al crear", description: err.message, variant: "destructive" });
    }
  };

  if (suppliers.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Primero crea al menos un proveedor para poder registrar bases.
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

      <div className="space-y-1.5">
        <Label htmlFor="rm-name">Nombre principal *</Label>
        <Input
          id="rm-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Camiseta Oversize"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Colores</Label>
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
          {colors.length === 0 && (
            <span className="text-xs text-muted-foreground">No hay colores en el catálogo.</span>
          )}
          {colors.map((c) => {
            const active = colorIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorIds((prev) => toggle(prev, c.id))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                {c.hex_code && (
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-border/50"
                    style={{ backgroundColor: c.hex_code }}
                  />
                )}
                {c.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Sin selección = una variante sin color asignado.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tallas</Label>
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
          {sizes.length === 0 && (
            <span className="text-xs text-muted-foreground">No hay tallas en el catálogo.</span>
          )}
          {sizes.map((s) => {
            const active = sizeIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSizeIds((prev) => toggle(prev, s.id))}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Sin selección = una variante sin talla asignada.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="rm-sku">SKU base</Label>
          <Input
            id="rm-sku"
            value={skuBase}
            onChange={(e) => setSkuBase(e.target.value)}
            placeholder="Opcional"
          />
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
          <Label htmlFor="rm-stock">Stock por variante</Label>
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

      {/* Preview */}
      {variants.length > 0 && (
        <div className="rounded-md border bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              Se crearán {variants.length} variante{variants.length !== 1 ? "s" : ""}.
            </p>
            {variants.length > 20 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Cantidad alta — confirma con cuidado
              </span>
            )}
          </div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {variants.slice(0, 50).map((v, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {v.name}
              </Badge>
            ))}
            {variants.length > 50 && (
              <span className="text-xs text-muted-foreground">
                +{variants.length - 50} más…
              </span>
            )}
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={createBatch.isPending || variants.length === 0}
        className="w-full sm:w-auto"
      >
        {createBatch.isPending
          ? "Guardando..."
          : `Crear ${variants.length || ""} variante${variants.length !== 1 ? "s" : ""}`.trim()}
      </Button>
    </form>
  );
}
