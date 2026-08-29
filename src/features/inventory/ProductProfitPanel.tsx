import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductWithChildren } from "./api";
import { useProductMaterialsBatch } from "@/features/production/api";
import { useGlobalConfigs } from "@/features/production/configApi";
import { useProductProcessesBatch } from "@/features/production-processes/api";

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

interface Props {
  parent: ProductWithChildren | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Costo de producción y rentabilidad por variante, calculado en vivo desde el
 * BOM (product_materials) + costos de proceso de configuración. No usa el
 * snapshot obsoleto products.cost.
 */
export function ProductProfitPanel({ parent, open, onOpenChange }: Props) {
  const childIds = useMemo(() => parent?.children.map((c) => c.id) ?? [], [parent]);
  const { data: bom = [], isLoading } = useProductMaterialsBatch(open ? childIds : []);
  const { data: processLinks = [] } = useProductProcessesBatch(open ? childIds : []);
  const { data: configs } = useGlobalConfigs();

  const printingPerMeter = Number(configs?.printing_cost_per_meter ?? 0);
  const ironingCost = Number(configs?.ironing_cost ?? 0);

  // Agrupa BOM por producto y separa base / tinta.
  const costByProduct = useMemo(() => {
    const map = new Map<string, { base: number; ink: number }>();
    for (const row of bom) {
      const price = Number(row.raw_material?.unit_price ?? 0);
      const line = Number(row.quantity_required) * price;
      const entry = map.get(row.product_id) ?? { base: 0, ink: 0 };
      if (row.role === "ink") entry.ink += line;
      else entry.base += line;
      map.set(row.product_id, entry);
    }
    return map;
  }, [bom]);

  // Costo de procesos adicionales por producto.
  const processCostByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of processLinks) {
      map.set(link.product_id, (map.get(link.product_id) ?? 0) + Number(link.process?.cost ?? 0));
    }
    return map;
  }, [processLinks]);

  const rows = useMemo(() => {
    return (parent?.children ?? []).map((c) => {
      const cost = costByProduct.get(c.id) ?? { base: 0, ink: 0 };
      const printing = (Number(c.print_height_cm ?? 0) / 100) * printingPerMeter;
      const processExtra = processCostByProduct.get(c.id) ?? 0;
      const process = printing + ironingCost + processExtra;
      const total = cost.base + cost.ink + process;
      const price = Number(c.price);
      const margin = price - total;
      const marginPct = price > 0 ? (margin / price) * 100 : 0;
      return { c, base: cost.base, ink: cost.ink, process, total, price, margin, marginPct };
    });
  }, [parent, costByProduct, processCostByProduct, printingPerMeter, ironingCost]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Costo y rentabilidad</DialogTitle>
          <DialogDescription>{parent?.name}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Estampado</TableHead>
                  <TableHead className="text-right">Altura</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Tinta</TableHead>
                  <TableHead className="text-right">Procesos</TableHead>
                  <TableHead className="text-right">Costo total</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-20 text-center text-sm text-muted-foreground">
                      Este producto no tiene variantes.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ c, base, ink, process, total, price, margin, marginPct }) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.sku}</TableCell>
                      <TableCell className="text-sm">{c.base_color ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.size ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.print_design ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {Number(c.print_height_cm ?? 0)} cm
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{COP(base)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{COP(ink)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{COP(process)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {COP(total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{COP(price)}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums text-sm font-medium ${
                          margin < 0 ? "text-status-red" : "text-status-green"
                        }`}
                      >
                        {COP(margin)} ({marginPct.toFixed(0)}%)
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
