import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateProduct, useUpdateProduct, type Product, type ProductInput } from "./api";
import { toast } from "@/hooks/use-toast";

interface Props {
  product?: Product | null;
  onSuccess?: () => void;
}

const empty: ProductInput = {
  sku: "",
  name: "",
  description: "",
  stock: 0,
  safety_stock: 0,
  aging_days: 0,
  price: 0,
  cost: 0,
  active: true,
};

export function ProductForm({ product, onSuccess }: Props) {
  const [form, setForm] = useState<ProductInput>(empty);
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const isEdit = !!product;
  const pending = create.isPending || update.isPending;

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
      });
    } else {
      setForm(empty);
    }
  }, [product]);

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      toast({ title: "Faltan datos", description: "SKU y nombre son obligatorios.", variant: "destructive" });
      return;
    }
    const payload: ProductInput = {
      ...form,
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: (form.description ?? "").toString().trim() || null,
    };
    try {
      if (isEdit && product) {
        await update.mutateAsync({ id: product.id, ...payload });
        toast({ title: "Producto actualizado" });
      } else {
        await create.mutateAsync(payload);
        toast({ title: "Producto creado" });
      }
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-sku">SKU *</Label>
          <Input id="p-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nombre *</Label>
          <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
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
      <div className="grid gap-4 sm:grid-cols-3">
        <NumField label="Stock" id="p-stock" value={form.stock} onChange={(v) => set("stock", v)} />
        <NumField label="Stock de seguridad" id="p-safety" value={form.safety_stock} onChange={(v) => set("safety_stock", v)} />
        <NumField label="Aging (días)" id="p-aging" value={form.aging_days} onChange={(v) => set("aging_days", v)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField label="Precio" id="p-price" value={form.price} step="0.01" onChange={(v) => set("price", v)} />
        <NumField label="Costo" id="p-cost" value={form.cost} step="0.01" onChange={(v) => set("cost", v)} />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="p-active" className="text-sm">Producto activo</Label>
          <p className="text-xs text-muted-foreground">Si se desactiva, no aparecerá en operaciones nuevas.</p>
        </div>
        <Switch id="p-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
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
