import { useEffect, useMemo, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useCreateProduct, useUpdateProduct, useProducts, type Product, type ProductInput } from "./api";
import { useRawMaterials } from "@/features/sourcing/api";
import { useGlobalConfigs } from "@/features/production/configApi";
import { useUpsertProductMaterial, useProductMaterials } from "@/features/production/api";
import { toast } from "@/hooks/use-toast";

interface Props {
  product?: Product | null;
  onSuccess?: () => void;
}

interface FormState extends ProductInput {
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
  base_material_id: null,
};

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function ProductForm({ product, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [baseName, setBaseName] = useState<string>("");

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
        base_material_id: null,
      });
    } else {
      setForm(empty);
    }
  }, [product]);

  // Detectar la base ya asociada al editar (primer ítem del BOM tomado como base)
  useEffect(() => {
    if (isEdit && existingBom.length > 0 && !form.base_material_id) {
      const first = existingBom[0];
      setForm((f) => ({ ...f, base_material_id: first.raw_material_id }));
    }
  }, [existingBom, isEdit, form.base_material_id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Opciones de "Camisa Base" — todos los raw_materials (Combobox con buscador)
  const baseOptions = useMemo(
    () =>
      rawMaterials.map((rm) => ({
        value: rm.id,
        label: `${rm.name}${rm.sku ? ` · ${rm.sku}` : ""} · ${COP(Number(rm.unit_price))}`,
      })),
    [rawMaterials],
  );

  const selectedBase = useMemo(
    () => rawMaterials.find((rm) => rm.id === form.base_material_id) ?? null,
    [rawMaterials, form.base_material_id],
  );

  // Cálculo automático del costo
  const baseCost = selectedBase ? Number(selectedBase.unit_price) : 0;
  const printingCost = (Number(form.print_height_cm) / 100) * printingPerMeter;
  const computedCost = baseCost + printingCost + ironingCost;

  useEffect(() => {
    setForm((f) => ({ ...f, cost: Math.round(computedCost) }));
  }, [computedCost]);

  // Nombre automático: "<base> <Talla> <ColorBase> / <Estampado>"
  useEffect(() => {
    setBaseName(selectedBase?.name ?? "");
  }, [selectedBase]);

  useEffect(() => {
    if (isEdit) return; // no sobrescribir nombre al editar
    const parts = [baseName, form.size, form.base_color].filter(Boolean).join(" ").trim();
    const tail = form.print_color ? ` / ${form.print_color}` : "";
    const auto = (parts + tail).trim();
    if (auto) setForm((f) => ({ ...f, name: auto }));
  }, [baseName, form.size, form.base_color, form.print_color, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      toast({ title: "Faltan datos", description: "SKU y nombre son obligatorios.", variant: "destructive" });
      return;
    }

    // SKU único
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

      // Vincular la Camisa Base como insumo (1 unidad por producto)
      if (form.base_material_id) {
        await upsertBom.mutateAsync({
          product_id: productId,
          raw_material_id: form.base_material_id,
          quantity_required: 1,
        });
      }

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

      {/* Estructura */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="p-size">Talla</Label>
          <Input id="p-size" placeholder="S, M, L, XL..." value={form.size ?? ""} onChange={(e) => set("size", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-base-color">Color base</Label>
          <Input id="p-base-color" placeholder="Negro, Blanco..." value={form.base_color ?? ""} onChange={(e) => set("base_color", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-print-color">Estampado</Label>
          <Input id="p-print-color" placeholder="Logo blanco, full color..." value={form.print_color ?? ""} onChange={(e) => set("print_color", e.target.value)} />
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

      {/* Receta base */}
      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Camisa base (insumo)</Label>
          {selectedBase && (
            <span className="text-xs text-muted-foreground">
              Stock: {Number(selectedBase.stock)} {selectedBase.unit_of_measure}
            </span>
          )}
        </div>
        <StandardCombobox
          options={baseOptions}
          value={form.base_material_id}
          onChange={(v) => set("base_material_id", v)}
          placeholder="Selecciona la camisa base..."
          searchPlaceholder="Buscar por nombre o SKU..."
          emptyText="Sin insumos. Crea una camisa base en Sourcing primero."
        />
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

      {/* Costo calculado */}
      <Alert className="border-primary/30 bg-primary/5">
        <Calculator className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo base (camisa)</span>
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

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
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
