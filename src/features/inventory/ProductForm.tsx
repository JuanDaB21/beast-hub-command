import { useEffect, useMemo, useState } from "react";
import { Calculator, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import {
  useCreateProductWithVariants,
  useUpdateProduct,
  useAddVariantsToParent,
  useProducts,
  type Product,
  type ProductInput,
  type VariantInput,
} from "./api";
import { useRawMaterials } from "@/features/sourcing/api";
import { groupMaterials } from "@/features/sourcing/groupHelpers";
import { useGlobalConfigs } from "@/features/production/configApi";
import { usePrintDesigns, type PrintDesign } from "@/features/print-designs/api";
import { toast } from "@/hooks/use-toast";
import { VariantPreviewTable, type PreviewRow } from "./VariantPreviewTable";

interface Props {
  product?: Product | null;
  onSuccess?: () => void;
}

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

export function ProductForm({ product, onSuccess }: Props) {
  // ── Modo edición de un padre legacy/existente ─────────────────────
  const isEdit = !!product;

  // ── Datos generales (padre) ──────────────────────────────────────
  const [skuPrefix, setSkuPrefix] = useState("");
  const [parentName, setParentName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  // ── Selección de base ─────────────────────────────────────────────
  const [baseGroupKey, setBaseGroupKey] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());

  // ── Estampados (selección desde catálogo) ────────────────────────
  const [selectedDesignIds, setSelectedDesignIds] = useState<Set<string>>(new Set());

  // ── Defaults aplicados a todas las variantes ─────────────────────
  const [defStock, setDefStock] = useState(0);
  const [defSafety, setDefSafety] = useState(0);
  const [defAging, setDefAging] = useState(30);
  const [defPrice, setDefPrice] = useState(0);
  const [defPrintHeight, setDefPrintHeight] = useState(0);

  const { data: products = [] } = useProducts();
  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: printDesigns = [] } = usePrintDesigns({ active: true });
  const { data: configs } = useGlobalConfigs();
  const createWithVariants = useCreateProductWithVariants();
  const addVariants = useAddVariantsToParent();
  const update = useUpdateProduct();
  const pending = createWithVariants.isPending || addVariants.isPending || update.isPending;

  // SKUs de hijos del padre actual (modo edición) — para detectar combinaciones que ya existen
  const existingChildSkus = useMemo(() => {
    if (!product) return new Set<string>();
    return new Set(
      products
        .filter((p) => p.parent_id === product.id)
        .map((p) => p.sku.toLowerCase()),
    );
  }, [products, product]);

  const printingPerMeter = Number(configs?.printing_cost_per_meter ?? 0);
  const ironingCost = Number(configs?.ironing_cost ?? 0);

  // Cargar producto en modo edición. La selección de base/colores/tallas/estampados
  // siempre arranca vacía: en edición sólo se usa para AGREGAR variantes nuevas.
  useEffect(() => {
    setBaseGroupKey(null);
    setSelectedColors(new Set());
    setSelectedSizes(new Set());
    setSelectedDesignIds(new Set());
    setDefStock(0);
    setDefSafety(0);
    setDefAging(30);
    setDefPrice(0);
    setDefPrintHeight(0);
    if (product) {
      setSkuPrefix(product.sku);
      setParentName(product.name);
      setProductUrl(product.product_url ?? "");
      setDescription(product.description ?? "");
      setActive(product.active);
    } else {
      setSkuPrefix("");
      setParentName("");
      setProductUrl("");
      setDescription("");
      setActive(true);
    }
  }, [product]);

  const groups = useMemo(() => groupMaterials(rawMaterials), [rawMaterials]);
  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === baseGroupKey) ?? null,
    [groups, baseGroupKey],
  );

  const baseOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: g.key,
        label: `${g.baseName} · ${g.supplier?.name ?? "Sin proveedor"} · ${g.variants.length} variantes`,
      })),
    [groups],
  );

  const colorOptions = useMemo(() => {
    if (!selectedGroup) return [] as { id: string; name: string }[];
    const map = new Map<string, { id: string; name: string }>();
    selectedGroup.variants.forEach((v) => {
      if (v.color_id && v.color?.name) map.set(v.color_id, { id: v.color_id, name: v.color.name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedGroup]);

  const sizeOptions = useMemo(() => {
    if (!selectedGroup) return [] as { id: string; label: string; sort: number }[];
    const map = new Map<string, { id: string; label: string; sort: number }>();
    selectedGroup.variants.forEach((v) => {
      if (v.size_id && v.size?.label)
        map.set(v.size_id, { id: v.size_id, label: v.size.label, sort: v.size.sort_order ?? 9999 });
    });
    return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
  }, [selectedGroup]);

  // Reset selecciones al cambiar la base
  const handleBaseChange = (key: string | null) => {
    setBaseGroupKey(key);
    setSelectedColors(new Set());
    setSelectedSizes(new Set());
  };

  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    fn(next);
  };

  const toggleDesign = (id: string) => {
    setSelectedDesignIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Vista previa de variantes ───────────────────────────────────
  const previewRows: PreviewRow[] = useMemo(() => {
    if (!selectedGroup || selectedColors.size === 0 || selectedSizes.size === 0) return [];
    const designList: Array<PrintDesign | null> =
      selectedDesignIds.size > 0
        ? printDesigns.filter((d) => selectedDesignIds.has(d.id))
        : [null]; // sin estampado → una variante por color×talla
    const rows: PreviewRow[] = [];
    selectedColors.forEach((cId) => {
      const colorName = colorOptions.find((c) => c.id === cId)?.name ?? "";
      selectedSizes.forEach((sId) => {
        const sizeLabel = sizeOptions.find((s) => s.id === sId)?.label ?? "";
        const variant = selectedGroup.variants.find(
          (v) => v.color_id === cId && v.size_id === sId,
        );
        designList.forEach((design) => {
          const printSuffix = design ? `-${slug(design.name)}` : "";
          const sku =
            (skuPrefix ? slug(skuPrefix) : "PROD") +
            `-${slug(colorName)}-${slug(sizeLabel)}${printSuffix}`;
          const fullName = [parentName || "Producto", colorName, sizeLabel]
            .filter(Boolean)
            .join(" ") + (design ? ` / ${design.name}` : "");
          rows.push({
            key: `${cId}-${sId}-${design?.id ?? ""}`,
            sku,
            name: fullName.trim(),
            variantLabel: variant?.name ?? `${selectedGroup.baseName} - ${colorName} - ${sizeLabel}`,
            available: !!variant,
            existing: existingChildSkus.has(sku.toLowerCase()),
          });
        });
      });
    });
    return rows;
  }, [
    selectedGroup,
    selectedColors,
    selectedSizes,
    selectedDesignIds,
    printDesigns,
    skuPrefix,
    parentName,
    colorOptions,
    sizeOptions,
    existingChildSkus,
  ]);

  // ── Costo por variante ────────────────────────────────────────────
  const baseCostSample = selectedGroup?.variants[0] ? Number(selectedGroup.variants[0].unit_price) : 0;
  const printingCost = (defPrintHeight / 100) * printingPerMeter;
  const computedCost = baseCostSample + printingCost + ironingCost;

  // ── SUBMIT ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!skuPrefix.trim() || !parentName.trim()) {
      toast({ title: "Faltan datos", description: "SKU y nombre son obligatorios.", variant: "destructive" });
      return;
    }

    // Construir variantes desde la selección actual (modo crear o agregar)
    const variants: VariantInput[] = [];
    if (selectedGroup) {
      const designList: Array<PrintDesign | null> =
        selectedDesignIds.size > 0
          ? printDesigns.filter((d) => selectedDesignIds.has(d.id))
          : [null];
      selectedColors.forEach((cId) => {
        const colorName = colorOptions.find((c) => c.id === cId)?.name ?? "";
        selectedSizes.forEach((sId) => {
          const sizeLabel = sizeOptions.find((s) => s.id === sId)?.label ?? "";
          const variant = selectedGroup.variants.find(
            (v) => v.color_id === cId && v.size_id === sId,
          );
          if (!variant) return;
          designList.forEach((design) => {
            const printSuffix = design ? `-${slug(design.name)}` : "";
            const sku =
              slug(skuPrefix) +
              `-${slug(colorName)}-${slug(sizeLabel)}${printSuffix}`;
            const fullName = [parentName, colorName, sizeLabel]
              .filter(Boolean)
              .join(" ") + (design ? ` / ${design.name}` : "");
            const baseCost = Number(variant.unit_price);
            const totalCost = baseCost + (defPrintHeight / 100) * printingPerMeter + ironingCost;
            const inkQty =
              design?.ink_raw_material_id && defPrintHeight > 0
                ? defPrintHeight * (design.ink_grams_per_cm ?? 0.5)
                : 0;
            variants.push({
              sku,
              name: fullName.trim(),
              base_color: colorName,
              size: sizeLabel,
              print_design: design?.name ?? null,
              print_design_id: design?.id ?? null,
              print_color: design?.hex_code ?? null,
              print_height_cm: defPrintHeight,
              raw_material_id: variant.id,
              ink_raw_material_id: design?.ink_raw_material_id ?? null,
              ink_quantity_required: inkQty,
              stock: defStock,
              safety_stock: defSafety,
              aging_days: defAging,
              price: defPrice,
              cost: Math.round(totalCost),
            });
          });
        });
      });
    }

    if (isEdit && product) {
      // ── Modo edición: update padre + (opcional) agregar variantes nuevas ──
      try {
        await update.mutateAsync({
          id: product.id,
          name: parentName.trim(),
          sku: skuPrefix.trim(),
          description: description.trim() || null,
          product_url: productUrl.trim() || null,
          active,
        });

        // Filtrar a las variantes nuevas (no existentes en el padre)
        const newVariants = variants.filter(
          (v) => !existingChildSkus.has(v.sku.toLowerCase()),
        );

        if (newVariants.length > 0) {
          // Validar duplicados internos (entre las nuevas)
          const seen = new Set<string>();
          for (const v of newVariants) {
            const key = v.sku.toLowerCase();
            if (seen.has(key)) {
              toast({ title: "SKUs duplicados", description: `Repetido: ${v.sku}`, variant: "destructive" });
              return;
            }
            seen.add(key);
          }
          // Validar contra todos los SKUs globales (excluyendo los hijos del padre actual)
          const globalSkus = new Set(
            products
              .filter((p) => p.parent_id !== product.id && p.id !== product.id)
              .map((p) => p.sku.toLowerCase()),
          );
          const conflict = newVariants.find((v) => globalSkus.has(v.sku.toLowerCase()));
          if (conflict) {
            toast({
              title: "SKU existente",
              description: `${conflict.sku} ya existe en otro producto.`,
              variant: "destructive",
            });
            return;
          }

          await addVariants.mutateAsync({
            parentId: product.id,
            parentDescription: description.trim() || null,
            parentUrl: productUrl.trim() || null,
            parentActive: active,
            variants: newVariants,
          });
          toast({
            title: "Producto actualizado",
            description: `${newVariants.length} variantes nuevas agregadas.`,
          });
        } else {
          toast({ title: "Producto actualizado" });
        }
        onSuccess?.();
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "No se pudo guardar",
          variant: "destructive",
        });
      }
      return;
    }

    // ── Modo creación ─────────────────────────────────────────────────
    if (!selectedGroup) {
      toast({ title: "Falta base padre", description: "Selecciona una base de raw_materials.", variant: "destructive" });
      return;
    }
    const validRows = previewRows.filter((r) => r.available);
    if (validRows.length === 0) {
      toast({
        title: "Sin variantes",
        description: "Selecciona al menos un color y una talla con variante material disponible.",
        variant: "destructive",
      });
      return;
    }

    // Verificar SKUs duplicados (entre sí o existentes)
    const seenSku = new Set<string>();
    for (const v of variants) {
      if (seenSku.has(v.sku)) {
        toast({ title: "SKUs duplicados", description: `Repetido: ${v.sku}`, variant: "destructive" });
        return;
      }
      seenSku.add(v.sku);
    }
    const existingSkus = new Set(products.map((p) => p.sku.toLowerCase()));
    const conflict = variants.find((v) => existingSkus.has(v.sku.toLowerCase()));
    if (conflict) {
      toast({ title: "SKU existente", description: `${conflict.sku} ya existe.`, variant: "destructive" });
      return;
    }
    if (existingSkus.has(skuPrefix.trim().toLowerCase())) {
      toast({
        title: "SKU padre existente",
        description: "Cambia el SKU base del producto padre.",
        variant: "destructive",
      });
      return;
    }

    const parentInput: ProductInput = {
      sku: skuPrefix.trim(),
      name: parentName.trim(),
      description: description.trim() || null,
      product_url: productUrl.trim() || null,
      stock: 0,
      safety_stock: 0,
      aging_days: defAging,
      price: defPrice,
      cost: 0,
      active,
      base_color: null,
      print_color: null,
      size: null,
      print_height_cm: 0,
      is_parent: true,
    };

    try {
      await createWithVariants.mutateAsync({ parent: parentInput, variants });
      toast({ title: "Producto creado", description: `${variants.length} variantes generadas.` });
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Error al crear",
        description: err instanceof Error ? err.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
    }
  };

  // ────────────────────────────── RENDER ──────────────────────────────
  const newRowsCount = previewRows.filter((r) => r.available && !r.existing).length;
  const submitLabel = isEdit
    ? newRowsCount > 0
      ? `Guardar cambios + ${newRowsCount} variantes nuevas`
      : "Guardar cambios"
    : pending
    ? "Creando..."
    : `Crear producto + ${previewRows.filter((r) => r.available).length} variantes`;
  const submitDisabled = isEdit
    ? pending
    : pending || previewRows.filter((r) => r.available).length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isEdit && (
        <Alert>
          <AlertDescription className="text-xs">
            Editas un producto existente. Puedes cambiar los datos del padre y agregar nuevas
            combinaciones de color/talla/estampado. Las variantes que ya existen se omitirán
            automáticamente.
          </AlertDescription>
        </Alert>
      )}
      {/* 1. Producto padre */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">1. Producto padre</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-sku">SKU base *</Label>
            <Input
              id="p-sku"
              placeholder="GYM-TRAIN"
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-url">URL del producto</Label>
            <Input
              id="p-url"
              type="url"
              placeholder="https://..."
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nombre del producto *</Label>
          <Input
            id="p-name"
            placeholder="Gymshark Training Shirt"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-desc">Descripción</Label>
          <Textarea
            id="p-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </section>

      {/* 2. Base padre */}
      <section className="space-y-3 rounded-lg border p-4 bg-muted/30">
        <h3 className="text-sm font-semibold">2. Base padre (raw material)</h3>
        <StandardCombobox
          options={baseOptions}
          value={baseGroupKey}
          onChange={handleBaseChange}
          placeholder="Selecciona la base padre..."
          searchPlaceholder="Buscar por nombre..."
          emptyText="No hay bases. Crea una en Proveedores y Bases primero."
        />

        {selectedGroup && (
          <>
            {/* Colores */}
            <div className="space-y-1.5">
              <Label className="text-xs">Colores disponibles</Label>
              {colorOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">La base no tiene colores configurados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedColors.has(c.id)}
                        onCheckedChange={() => toggle(selectedColors, c.id, setSelectedColors)}
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tallas */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tallas disponibles</Label>
              {sizeOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">La base no tiene tallas configuradas.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedSizes.has(s.id)}
                        onCheckedChange={() => toggle(selectedSizes, s.id, setSelectedSizes)}
                      />
                      <span className="text-sm">{s.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* 3. Estampados */}
      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">3. Estampados</h3>
        {printDesigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay estampados activos. Créalos en{" "}
            <span className="font-medium">Configuración → Estampados</span>.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {printDesigns.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedDesignIds.has(d.id)}
                    onCheckedChange={() => toggleDesign(d.id)}
                  />
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border border-border flex-shrink-0"
                    style={{ backgroundColor: d.hex_code }}
                  />
                  <span className="text-sm">{d.name}</span>
                  {d.ink_raw_material && (
                    <Badge variant="secondary" className="text-xs py-0">
                      tinta
                    </Badge>
                  )}
                </label>
              ))}
            </div>
            {selectedDesignIds.size === 0 && (
              <p className="text-xs text-muted-foreground">
                Sin selección: se crea una variante por color×talla sin estampado.
              </p>
            )}
          </>
        )}
      </section>

      {/* 4. Defaults */}
      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">4. Valores por defecto (aplicados a todas las variantes)</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumField label="Stock inicial" value={defStock} onChange={setDefStock} />
          <NumField label="Stock seguridad" value={defSafety} onChange={setDefSafety} />
          <NumField label="Aging (días)" value={defAging} onChange={setDefAging} />
          <NumField label="Precio venta" step="100" value={defPrice} onChange={setDefPrice} />
          <NumField label="Altura estampado (cm)" step="0.5" value={defPrintHeight} onChange={setDefPrintHeight} />
        </div>

        <Alert className="border-primary/30 bg-primary/5">
          <Calculator className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo base (ejemplo variante)</span>
                <span className="tabular-nums">{COP(baseCostSample)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Impresión ({defPrintHeight} cm × {COP(printingPerMeter)}/m)
                </span>
                <span className="tabular-nums">{COP(printingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Planchado</span>
                <span className="tabular-nums">{COP(ironingCost)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                <span>Costo estimado por variante</span>
                <span className="tabular-nums">{COP(computedCost)}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="p-active">Producto activo</Label>
          <Switch id="p-active" checked={active} onCheckedChange={setActive} />
        </div>
      </section>

      {/* 5. Vista previa */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">5. Vista previa de variantes</h3>
        {previewRows.length > 0 && previewRows.some((r) => !r.available) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Algunas combinaciones no tienen variante material. Créalas en Bases o desmárcalas.
            </AlertDescription>
          </Alert>
        )}
        <VariantPreviewTable rows={previewRows} />
      </section>

      <Button
        type="submit"
        disabled={submitDisabled}
        className="w-full sm:w-auto"
      >
        {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
