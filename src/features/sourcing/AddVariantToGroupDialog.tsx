import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  findExistingVariantNames,
  useColors,
  useCreateColor,
  useCreateRawMaterialsBatch,
  useSizes,
  type RawMaterialInput,
} from "./api";
import { buildVariantName, buildVariantSku, type MaterialGroup } from "./groupHelpers";

interface Props {
  group: MaterialGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const comboKey = (colorId: string | null, sizeId: string | null) =>
  `${colorId ?? ""}::${sizeId ?? ""}`;

export function AddVariantToGroupDialog({ group, open, onOpenChange }: Props) {
  const { data: colors = [] } = useColors();
  const { data: sizes = [] } = useSizes();
  const createColor = useCreateColor();
  const createBatch = useCreateRawMaterialsBatch();

  const [colorIds, setColorIds] = useState<string[]>([]);
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [skuBase, setSkuBase] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [unitOfMeasure, setUnitOfMeasure] = useState("unit");
  const [stock, setStock] = useState("0");

  const [showNewColor, setShowNewColor] = useState(false);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#000000");

  const first = group?.variants[0] ?? null;

  useEffect(() => {
    if (!group || !first) return;
    setColorIds([]);
    setSizeIds([]);
    setSkuBase("");
    setUnitPrice(String(first.unit_price ?? 0));
    setUnitOfMeasure(first.unit_of_measure ?? "unit");
    setStock("0");
    setShowNewColor(false);
    setNewColorName("");
    setNewColorHex("#000000");
  }, [group, first]);

  // Combinaciones color×talla ya existentes en el grupo.
  const existingCombos = useMemo(() => {
    const set = new Set<string>();
    group?.variants.forEach((v) => set.add(comboKey(v.color_id, v.size_id)));
    return set;
  }, [group]);

  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  // Matriz de variantes a partir de la selección actual.
  const variants = useMemo(() => {
    if (!group) return [];
    const cs = colorIds.length > 0 ? colorIds.map((id) => colors.find((c) => c.id === id) ?? null) : [null];
    const ss = sizeIds.length > 0 ? sizeIds.map((id) => sizes.find((s) => s.id === id) ?? null) : [null];
    const out: {
      name: string;
      color_id: string | null;
      size_id: string | null;
      sku: string | null;
      existing: boolean;
    }[] = [];
    for (const c of cs) {
      for (const s of ss) {
        out.push({
          name: buildVariantName(group.baseName, c?.name, s?.label),
          color_id: c?.id ?? null,
          size_id: s?.id ?? null,
          sku: buildVariantSku(skuBase, c?.name, s?.label),
          existing: existingCombos.has(comboKey(c?.id ?? null, s?.id ?? null)),
        });
      }
    }
    return out;
  }, [group, colorIds, sizeIds, colors, sizes, skuBase, existingCombos]);

  const newVariants = variants.filter((v) => !v.existing);

  const handleCreateColor = async () => {
    const value = newColorName.trim();
    if (!value) return;
    try {
      const color = await createColor.mutateAsync({ name: value, hex_code: newColorHex || null });
      if (!color || typeof color.id !== "string") throw new Error("Respuesta inválida al crear el color");
      setColorIds((prev) => (prev.includes(color.id) ? prev : [...prev, color.id]));
      setNewColorName("");
      setNewColorHex("#000000");
      setShowNewColor(false);
      toast({ title: "Color creado", description: color.name });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "No se pudo crear el color", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !first) return;
    if (newVariants.length === 0) {
      toast({
        title: "Sin variantes nuevas",
        description: "Selecciona al menos un color/talla que no exista ya en esta base.",
        variant: "destructive",
      });
      return;
    }
    try {
      const existing = await findExistingVariantNames(
        first.supplier_id,
        first.category_id,
        newVariants.map((v) => v.name),
      );
      const toInsert = newVariants.filter((v) => !existing.has(v.name));
      const skipped = newVariants.length - toInsert.length;
      if (toInsert.length === 0) {
        toast({
          title: "Todas las variantes ya existen",
          description: "No se creó ningún registro nuevo.",
          variant: "destructive",
        });
        return;
      }

      const payloads: RawMaterialInput[] = toInsert.map((v) => ({
        supplier_id: first.supplier_id,
        category_id: first.category_id,
        subcategory_id: first.subcategory_id,
        color_id: v.color_id,
        size_id: v.size_id,
        sku: v.sku,
        name: v.name,
        unit_price: Number(unitPrice) || 0,
        unit_of_measure: unitOfMeasure.trim() || "unit",
        stock: Number(stock) || 0,
      }));

      await createBatch.mutateAsync(payloads);
      toast({
        title: `${toInsert.length} variante(s) agregada(s)`,
        description: skipped > 0 ? `${skipped} omitida(s) por duplicado.` : undefined,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error al crear", description: err?.message ?? "Inténtalo de nuevo", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar variante</DialogTitle>
          <DialogDescription>
            {group?.baseName}
            {group?.supplier?.name ? ` · ${group.supplier.name}` : ""}
            {group?.category?.name ? ` · ${group.category.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Colores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Colores</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setShowNewColor((v) => !v)}
              >
                {showNewColor ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {showNewColor ? "Cancelar" : "Nuevo"}
              </Button>
            </div>
            {showNewColor && (
              <div className="flex items-center gap-2 rounded-md border p-2">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  aria-label="Tono del color"
                />
                <Input
                  autoFocus
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="Nombre del color"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateColor();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateColor}
                  disabled={createColor.isPending || !newColorName.trim()}
                >
                  {createColor.isPending ? "..." : "Crear"}
                </Button>
              </div>
            )}
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
          </div>

          {/* Tallas */}
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
              Sin selección = una variante sin color/talla asignado.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="av-sku">SKU base</Label>
              <Input
                id="av-sku"
                value={skuBase}
                onChange={(e) => setSkuBase(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-price">Precio</Label>
              <Input
                id="av-price"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-stock">Stock por variante</Label>
              <Input
                id="av-stock"
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
              <p className="mb-2 text-sm font-medium">
                {newVariants.length > 0
                  ? `Se agregarán ${newVariants.length} variante${newVariants.length !== 1 ? "s" : ""}.`
                  : "Todas las combinaciones seleccionadas ya existen."}
              </p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {variants.slice(0, 50).map((v, i) => (
                  <Badge
                    key={i}
                    variant={v.existing ? "outline" : "secondary"}
                    className={cn("font-normal", v.existing && "text-muted-foreground line-through")}
                  >
                    {[
                      colors.find((c) => c.id === v.color_id)?.name,
                      sizes.find((s) => s.id === v.size_id)?.label,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin color/talla"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createBatch.isPending || newVariants.length === 0}>
              {createBatch.isPending
                ? "Guardando..."
                : `Agregar ${newVariants.length || ""} variante${newVariants.length !== 1 ? "s" : ""}`.trim()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
