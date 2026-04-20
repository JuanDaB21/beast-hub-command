import { useState } from "react";
import { Info, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useProducts } from "@/features/inventory/api";
import { useRawMaterials } from "@/features/sourcing/api";
import {
  useProductMaterials,
  useUpsertProductMaterial,
  useDeleteProductMaterial,
} from "./api";
import { toast } from "sonner";

function stockBadge(stock: number, perUnit: number, unit: string) {
  const unitsPossible = perUnit > 0 ? Math.floor(stock / perUnit) : 0;
  if (stock <= 0)
    return (
      <Badge variant="outline" className="bg-status-red/15 text-status-red border-status-red/30">
        Sin stock
      </Badge>
    );
  if (unitsPossible < 10)
    return (
      <Badge
        variant="outline"
        className="bg-status-yellow/15 text-status-yellow border-status-yellow/40"
      >
        Alcanza ~{unitsPossible} u
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="bg-status-green/15 text-status-green border-status-green/30"
    >
      {stock} {unit} en stock
    </Badge>
  );
}

/**
 * Gestor de Recetas (BOM): asocia un producto con sus insumos y cantidad por unidad.
 */
export function RecipeManager() {
  const { data: products = [] } = useProducts();
  const { data: rawMaterials = [] } = useRawMaterials();

  const [productId, setProductId] = useState<string | null>(null);
  const { data: bom = [], isLoading } = useProductMaterials(productId);
  const upsert = useUpsertProductMaterial();
  const remove = useDeleteProductMaterial();

  const [newRm, setNewRm] = useState<string | null>(null);
  const [newQty, setNewQty] = useState<number>(1);

  const productOptions = products
    .filter((p) => p.active)
    .map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }));
  const rmOptions = rawMaterials.map((r) => ({
    value: r.id,
    label: `${r.name}${r.sku ? ` (${r.sku})` : ""}`,
  }));

  const handleAdd = async () => {
    if (!productId || !newRm || newQty <= 0) {
      toast.error("Selecciona producto, insumo y cantidad");
      return;
    }
    try {
      await upsert.mutateAsync({
        product_id: productId,
        raw_material_id: newRm,
        quantity_required: newQty,
      });
      toast.success("Insumo agregado a la receta");
      setNewRm(null);
      setNewQty(1);
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Producto</Label>
        <StandardCombobox
          options={productOptions}
          value={productId}
          onChange={setProductId}
          placeholder="Selecciona un producto para gestionar su receta"
          searchPlaceholder="Buscar SKU o nombre..."
        />
      </div>

      {productId && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Define todos los componentes para producir <strong>1 unidad</strong> (camiseta base +
              sticker DTF + hilos, etc.). Al completar un lote, se descontarán automáticamente del
              inventario.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border">
            <div className="p-3 border-b bg-muted/30">
              <p className="text-sm font-medium">Componentes / insumos por unidad</p>
            </div>
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Cargando...</div>
            ) : bom.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Sin receta definida. Agrega componentes abajo.
              </div>
            ) : (
              <ul className="divide-y">
                {bom.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{row.raw_material?.name ?? "—"}</p>
                      <div className="mt-1">
                        {stockBadge(
                          Number(row.raw_material?.stock ?? 0),
                          Number(row.quantity_required),
                          row.raw_material?.unit_of_measure ?? "",
                        )}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums whitespace-nowrap">
                      {row.quantity_required} {row.raw_material?.unit_of_measure ?? ""} / u
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove.mutate({ id: row.id, product_id: productId })}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Agregar / actualizar componente</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <StandardCombobox
                  options={rmOptions}
                  value={newRm}
                  onChange={setNewRm}
                  placeholder="Componente / insumo"
                  searchPlaceholder="Buscar componente..."
                />
              </div>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={newQty}
                onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
                className="w-full sm:w-28"
                placeholder="Cantidad"
              />
              <Button onClick={handleAdd} disabled={upsert.isPending}>
                {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-1">Guardar</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Si el componente ya existe en la receta, se actualizará la cantidad.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
