import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, PackageX, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useProductMaterialsBatch } from "./api";
import { useAutoSupplyShortages } from "@/features/supply-requests/api";

export interface DraftLine {
  product_id: string | null;
  quantity_to_produce: number;
}

interface Props {
  items: DraftLine[];
  /** Map of productId -> display label, for "missing recipe" warnings. */
  productLabels?: Record<string, string>;
  /** Show the "auto-generate supply request" CTA when shortages exist. */
  enableAutoSupply?: boolean;
}

interface AggregatedRow {
  raw_material_id: string;
  name: string;
  unit: string;
  required: number;
  stock: number;
  supplier_id: string | null;
}

export function ProductionRequirementsSummary({
  items,
  productLabels = {},
  enableAutoSupply = true,
}: Props) {
  const validItems = items.filter(
    (it): it is { product_id: string; quantity_to_produce: number } =>
      !!it.product_id && it.quantity_to_produce > 0,
  );
  const productIds = useMemo(
    () => Array.from(new Set(validItems.map((it) => it.product_id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validItems.map((i) => i.product_id).join(",")],
  );

  const { data: bom = [], isLoading } = useProductMaterialsBatch(productIds);
  const autoSupply = useAutoSupplyShortages();
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);

  const productsWithoutRecipe = useMemo(() => {
    if (isLoading) return [];
    const withRecipe = new Set(bom.map((b) => b.product_id));
    return productIds.filter((id) => !withRecipe.has(id));
  }, [bom, productIds, isLoading]);

  const rows = useMemo<AggregatedRow[]>(() => {
    const map = new Map<string, AggregatedRow>();
    for (const item of validItems) {
      const recipe = bom.filter((b) => b.product_id === item.product_id);
      for (const r of recipe) {
        if (!r.raw_material) continue;
        const need = Number(r.quantity_required) * item.quantity_to_produce;
        const existing = map.get(r.raw_material_id);
        if (existing) {
          existing.required += need;
        } else {
          map.set(r.raw_material_id, {
            raw_material_id: r.raw_material_id,
            name: r.raw_material.name,
            unit: r.raw_material.unit_of_measure ?? "",
            required: need,
            stock: Number(r.raw_material.stock) ?? 0,
            supplier_id: r.raw_material.supplier_id ?? null,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bom, validItems]);

  const shortages = rows.filter((r) => r.stock < r.required);
  const shortagesWithSupplier = shortages.filter((s) => !!s.supplier_id);
  const shortagesWithoutSupplier = shortages.filter((s) => !s.supplier_id);

  const handleAutoSupply = async () => {
    if (!shortagesWithSupplier.length) return;
    try {
      const res = await autoSupply.mutateAsync(
        shortagesWithSupplier.map((s) => ({
          raw_material_id: s.raw_material_id,
          raw_material_name: s.name,
          supplier_id: s.supplier_id!,
          missing: s.required - s.stock,
        })),
      );
      setGeneratedIds(res.request_ids);
      toast.success("Solicitud de abastecimiento generada", {
        description: `${res.created} nueva(s), ${res.updated} actualizada(s) · ${res.total_units} unidades`,
      });
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  if (validItems.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
        Agrega productos al lote para ver los componentes que necesitas.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando necesidades...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {productsWithoutRecipe.length > 0 && (
        <Alert variant="destructive">
          <PackageX className="h-4 w-4" />
          <AlertTitle>Productos sin receta definida</AlertTitle>
          <AlertDescription>
            {productsWithoutRecipe
              .map((id) => productLabels[id] ?? id.slice(0, 8))
              .join(", ")}
            . Define los componentes en la pestaña <strong>Recetas (BOM)</strong> para calcular
            necesidades.
          </AlertDescription>
        </Alert>
      )}

      {rows.length === 0 && productsWithoutRecipe.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground text-center">
          Sin componentes calculados.
        </div>
      ) : rows.length > 0 ? (
        <>
          {shortages.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Faltan {shortages.length} base(s)</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Stock insuficiente. {enableAutoSupply && shortagesWithSupplier.length > 0
                    ? "Puedes generar una solicitud sugerida al proveedor con un margen del 20%."
                    : "Considera ajustar cantidades o reabastecer antes de iniciar el lote."}
                </p>
                {shortagesWithoutSupplier.length > 0 && (
                  <p className="text-xs">
                    {shortagesWithoutSupplier.length} base(s) sin proveedor asignado quedarán fuera
                    de la solicitud automática.
                  </p>
                )}
                {enableAutoSupply && shortagesWithSupplier.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleAutoSupply}
                      disabled={autoSupply.isPending}
                    >
                      {autoSupply.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Generar solicitud sugerida
                    </Button>
                    {generatedIds.length > 0 && (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link to="/solicitudes">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Ver solicitud{generatedIds.length > 1 ? "es" : ""} generada
                          {generatedIds.length > 1 ? "s" : ""}
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Stock suficiente</AlertTitle>
              <AlertDescription>
                Tienes todos los componentes necesarios para producir este lote.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Componente</TableHead>
                  <TableHead className="text-right">Requerido</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Faltante / Comprar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const missing = Math.max(0, r.required - r.stock);
                  const ok = missing === 0;
                  return (
                    <TableRow
                      key={r.raw_material_id}
                      className={ok ? undefined : "bg-status-red/5"}
                    >
                      <TableCell className="font-medium">
                        <span className={ok ? undefined : "text-status-red"}>{r.name}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.required} {r.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.stock} {r.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {ok ? (
                          <Badge
                            variant="outline"
                            className="bg-status-green/15 text-status-green border-status-green/30"
                          >
                            ✓ Suficiente
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-status-red/15 text-status-red border-status-red/30 tabular-nums"
                          >
                            {missing} {r.unit}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}

