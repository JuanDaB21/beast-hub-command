import { useEffect, useMemo, useState } from "react";
import { Calculator, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useCreateProduct, useUpdateProduct, useProducts, type Product, type ProductInput } from "./api";
import { useRawMaterials } from "@/features/sourcing/api";
import { groupMaterials } from "@/features/sourcing/groupHelpers";
import { useGlobalConfigs } from "@/features/production/configApi";
import { useUpsertProductMaterial, useProductMaterials } from "@/features/production/api";
import { toast } from "@/hooks/use-toast";

interface Props {
  product?: Product | null;
  onSuccess?: () => void;
}

interface FormState extends ProductInput {
  base_group_key: string | null;
  base_color_id: string | null;
  base_size_id: string | null;
  base_material_id: string | null;
}

const empty: FormState = {
  sku: "",
  name: "",
  description: "",
  stock: 0,
  safety_stock: 0,
  aging_days: 30,
  price: 0,
  cost: 0,
  active: true,
  product_url: "",
  base_color: "",
  print_color: "",
  size: "",
  print_height_cm: 0,
  base_group_key: null,
  base_color_id: null,
  base_size_id: null,
  base_material_id: null,
};

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function ProductForm({ product, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(empty);

  const { data: products = [] } = useProducts();
  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: configs } = useGlobalConfigs();
  const { data: existingBom = [] } = useProductMaterials(product?.id ?? null);

  const create = useCreateProduct();
  const update = useUpdateProduct();
  const upsertBom = useUpsertProductMaterial();

  const isEdit = !!product;
  const pending = create.isPending || update.isPending || upsertBom.isPending;

  const printingPerMeter = Number(configs?.printing_cost_per_meter ?? 0);
  const ironingCost = Number(configs?.ironing_cost ?? 0);

  // Agrupar bases padre
  const groups = useMemo(() => groupMaterials(rawMaterials), [rawMaterials]);
  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === form.base_group_key) ?? null,
    [groups, form.base_group_key],
  );

  // Cargar producto existente
  useEffect(() => {
    if (product) {
      setForm({
        sku: product.sku,
        name: product.name,
        description: product.description ?? "",
        stock: Number(product.stock),
        safety_stock: Number(product.safety_stock),
        aging_days: Number(product.aging_days),
        price: Number(product.price),
        cost: Number(product.cost),
        active: product.active,
        product_url: product.product_url ?? "",
        base_color: product.base_color ?? "",
        print_color: product.print_color ?? "",
        size: product.size ?? "",
        print_height_cm: Number(product.print_height_cm ?? 0),
        base_group_key: null,
        base_color_id: null,
        base_size_id: null,
        base_material_id: null,
      });
    } else {
      setForm(empty);
    }
  }, [product]);

  // Al editar, reconstruir Base/Color/Talla desde el BOM existente
  useEffect(() => {
    if (!isEdit) return;
    if (form.base_material_id) return;
    if (existingBom.length === 0 || groups.length === 0) return;
    const variantId = existingBom[0].raw_material_id;
    const grp = groups.find((g) => g.variants.some((v) => v.id === variantId));
    if (!grp) return;
    const variant = grp.variants.find((v) => v.id === variantId)!;
    setForm((f) => ({
      ...f,
      base_group_key: grp.key,
      base_color_id: variant.color_id ?? null,
      base_size_id: variant.size_id ?? null,
      base_material_id: variant.id,
    }));
  }, [existingBom, groups, isEdit, form.base_material_id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Opciones de Base padre
  const baseOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: g.key,
        label: `${g.baseName} · ${g.supplier?.name ?? "Sin proveedor"} · ${g.variants.length} variantes`,
      })),
    [groups],
  );

  // Colores y tallas únicos del grupo seleccionado
  const colorOptions = useMemo(() => {
    if (!selectedGroup) return [];
    const map = new Map<string, { id: string; name: string }>();
    selectedGroup.variants.forEach((v) => {
      if (v.color_id && v.color?.name) map.set(v.color_id, { id: v.color_id, name: v.color.name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedGroup]);

  const sizeOptions = useMemo(() => {
    if (!selectedGroup) return [];
    const map = new Map<string, { id: string; label: string; sort: number }>();
    selectedGroup.variants.forEach((v) => {
      if (v.size_id && v.size?.label)
        map.set(v.size_id, { id: v.size_id, label: v.size.label, sort: v.size.sort_order ?? 9999 });
    });
    return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
  }, [selectedGroup]);

  // Resolver variante exacta
  const resolvedVariant = useMemo(() => {
    if (!selectedGroup || !form.base_color_id || !form.base_size_id) return null;
    return (
      selectedGroup.variants.find(
        (v) => v.color_id === form.base_color_id && v.size_id === form.base_size_id,
      ) ?? null
    );
  }, [selectedGroup, form.base_color_id, form.base_size_id]);

  const variantMissing =
    !!selectedGroup && !!form.base_color_id && !!form.base_size_id && !resolvedVariant;

  // Sincronizar variante resuelta + textos en form
  useEffect(() => {
    const colorName = colorOptions.find((c) => c.id === form.base_color_id)?.name ?? "";
    const sizeLabel = sizeOptions.find((s) => s.id === form.base_size_id)?.label ?? "";
    setForm((f) => ({
      ...f,
      base_material_id: resolvedVariant?.id ?? null,
      base_color: colorName,
      size: sizeLabel,
    }));
  }, [resolvedVariant, form.base_color_id, form.base_size_id, colorOptions, sizeOptions]);

  // Reset color/talla cuando cambia el grupo
  const handleGroupChange = (key: string | null) => {
    setForm((f) => ({
      ...f,
      base_group_key: key,
      base_color_id: null,
      base_size_id: null,
      base_material_id: null,
      base_color: "",
      size: "",
    }));
  };

  // Cálculo automático del costo
  const baseCost = resolvedVariant ? Number(resolvedVariant.unit_price) : 0;
  const printingCost = (Number(form.print_height_cm) / 100) * printingPerMeter;
  const computedCost = baseCost + printingCost + ironingCost;

  useEffect(() => {
    setForm((f) => ({ ...f, cost: Math.round(computedCost) }));
  }, [computedCost]);

  // Nombre automático
  useEffect(() => {
    if (isEdit) return;
    const baseName = selectedGroup?.baseName ?? "";
    const parts = [baseName, form.size, form.base_color].filter(Boolean).join(" ").trim();
    const tail = form.print_color ? ` / ${form.print_color}` : "";
    const auto = (parts + tail).trim();
    if (auto) setForm((f) => ({ ...f, name: auto }));
  }, [selectedGroup, form.size, form.base_color, form.print_color, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      toast({ title: "Faltan datos", description: "SKU y nombre son obligatorios.", variant: "destructive" });
      return;
    }
    if (!form.base_material_id) {
      toast({
        title: "Falta variante base",
        description: "Selecciona Base padre, Color y Talla disponibles.",
        variant: "destructive",
      });
      return;
    }

    const skuTaken = products.some(
      (p) => p.sku.toLowerCase() === form.sku.trim().toLowerCase() && p.id !== product?.id,
    );
    if (skuTaken) {
      toast({ title: "SKU duplicado", description: "Ya existe un producto con ese SKU.", variant: "destructive" });
      return;
    }

    const payload: ProductInput = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: (form.description ?? "").toString().trim() || null,
      stock: form.stock,
      safety_stock: form.safety_stock,
      aging_days: form.aging_days,
      price: form.price,
      cost: form.cost,
      active: form.active,
      product_url: (form.product_url ?? "").toString().trim() || null,
      base_color: (form.base_color ?? "").toString().trim() || null,
      print_color: (form.print_color ?? "").toString().trim() || null,
      size: (form.size ?? "").toString().trim() || null,
      print_height_cm: Number(form.print_height_cm) || 0,
    };

    try {
      let productId: string;
      if (isEdit && product) {
        const updated = await update.mutateAsync({ id: product.id, ...payload });
        productId = (updated as Product).id;
        toast({ title: "Producto actualizado" });
      } else {
        const created = await create.mutateAsync(payload);
        productId = (created as Product).id;
        toast({ title: "Producto creado" });
      }

      await upsertBom.mutateAsync({
        product_id: productId,
        raw_material_id: form.base_material_id,
        quantity_required: 1,
      });

      onSuccess?.();
    } catch (err) {
      toast({
        title: "Error al guardar",
        description: err instanceof Error ? err.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Identificación */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-sku">SKU *</Label>
          <Input id="p-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-url">URL del producto</Label>
          <Input
            id="p-url"
            type="url"
            placeholder="https://..."
            value={form.product_url ?? ""}
            onChange={(e) => set("product_url", e.target.value)}
          />
        </div>
      </div>

      {/* Variante base */}
      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
        <Label className="text-sm font-medium">Base padre *</Label>
        <StandardCombobox
          options={baseOptions}
          value={form.base_group_key}
          onChange={handleGroupChange}
          placeholder="Selecciona la base padre..."
          searchPlaceholder="Buscar por nombre..."
          emptyText="No hay bases. Crea una en Proveedores y Bases primero."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-color">Color base *</Label>
            <Select
              value={form.base_color_id ?? ""}
              onValueChange={(v) => set("base_color_id", v || null)}
              disabled={!selectedGroup || colorOptions.length === 0}
            >
              <SelectTrigger id="p-color">
                <SelectValue placeholder={selectedGroup ? "Selecciona color" : "Elige base primero"} />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-size">Talla *</Label>
            <Select
              value={form.base_size_id ?? ""}
              onValueChange={(v) => set("base_size_id", v || null)}
              disabled={!selectedGroup || sizeOptions.length === 0}
            >
              <SelectTrigger id="p-size">
                <SelectValue placeholder={selectedGroup ? "Selecciona talla" : "Elige base primero"} />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {variantMissing && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta combinación no está disponible como variante. Créala primero en Bases.
            </AlertDescription>
          </Alert>
        )}

        {resolvedVariant && (
          <p className="text-xs text-muted-foreground">
            Variante: <span className="font-medium text-foreground">{resolvedVariant.name}</span> · Stock:{" "}
            {Number(resolvedVariant.stock)} {resolvedVariant.unit_of_measure}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="p-print-color">Estampado</Label>
          <Input
            id="p-print-color"
            placeholder="Logo blanco, full color..."
            value={form.print_color ?? ""}
            onChange={(e) => set("print_color", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-print-h">Altura del estampado (cm)</Label>
          <Input
            id="p-print-h"
            type="number"
            min="0"
            step="0.5"
            value={form.print_height_cm ?? 0}
            onChange={(e) => set("print_height_cm", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-name">Nombre {isEdit ? "" : "(auto)"} *</Label>
        <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        {!isEdit && (
          <p className="text-xs text-muted-foreground">
            Se arma automáticamente con Base + Talla + Color base / Estampado. Puedes editarlo.
          </p>
        )}
      </div>

      {/* Costo calculado */}
      <Alert className="border-primary/30 bg-primary/5">
        <Calculator className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo base (variante)</span>
              <span className="tabular-nums">{COP(baseCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Impresión ({Number(form.print_height_cm) || 0} cm × {COP(printingPerMeter)}/m)
              </span>
              <span className="tabular-nums">{COP(printingCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Planchado</span>
              <span className="tabular-nums">{COP(ironingCost)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
              <span>Costo total</span>
              <span className="tabular-nums">{COP(computedCost)}</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Precio venta + stock */}
      <div className="grid gap-4 sm:grid-cols-3">
        <NumField label="Precio de venta" id="p-price" value={form.price} step="100" onChange={(v) => set("price", v)} />
        <NumField label="Stock inicial" id="p-stock" value={form.stock} onChange={(v) => set("stock", v)} />
        <NumField label="Stock seguridad" id="p-safety" value={form.safety_stock} onChange={(v) => set("safety_stock", v)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumField label="Aging (días)" id="p-aging" value={form.aging_days} onChange={(v) => set("aging_days", v)} />
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="p-active" className="text-sm">Producto activo</Label>
            <p className="text-xs text-muted-foreground">Si se desactiva, no aparecerá en operaciones nuevas.</p>
          </div>
          <Switch id="p-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-desc">Descripción</Label>
        <Textarea
          id="p-desc"
          rows={2}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <Button type="submit" disabled={pending || variantMissing} className="w-full sm:w-auto">
        {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        {pending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  );
}

function NumField({
  label,
  id,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  id: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
