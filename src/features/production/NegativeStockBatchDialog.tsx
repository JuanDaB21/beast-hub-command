import { useEffect, useState } from "react";
import { Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNegativeStockPreview, useCreateWorkOrder } from "./api";

/**
 * Previsualiza los productos con stock negativo cuyo faltante no se cubre ni
 * sumando lo que ya está en producción, y crea un lote (pending) con la cantidad
 * necesaria para dejar el neto en 0. Las cantidades son editables antes de crear.
 */
export function NegativeStockBatchDialog() {
  const [open, setOpen] = useState(false);
  const { data: rows = [], isLoading } = useNegativeStockPreview(open);
  const create = useCreateWorkOrder();

  // Cantidades editables por producto (default = déficit para llegar a 0).
  const [qty, setQty] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setQty(Object.fromEntries(rows.map((r) => [r.product_id, String(r.quantity_to_produce)])));
    }
  }, [rows, open]);

  const handleCreate = async () => {
    const items = rows
      .map((r) => ({
        product_id: r.product_id,
        quantity_to_produce: Math.max(0, Math.round(Number(qty[r.product_id]) || 0)),
      }))
      .filter((it) => it.quantity_to_produce > 0);

    if (!items.length) {
      toast.error("No hay cantidades a producir");
      return;
    }

    try {
      await create.mutateAsync({
        notes: "Lote de faltantes (stock negativo)",
        items,
      });
      toast.success("Lote de faltantes creado", {
        description: `${items.length} producto(s) · ${items.reduce((a, i) => a + i.quantity_to_produce, 0)} unidades`,
      });
      setOpen(false);
    } catch (err) {
      toast.error("No se pudo crear el lote", { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Factory className="h-4 w-4 mr-1" /> Lote de faltantes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Lote de faltantes (stock negativo)</DialogTitle>
          <DialogDescription>
            Productos vendidos que aún no tenemos: su stock es negativo y el faltante no se cubre
            ni sumando lo que ya está en producción. La cantidad sugerida deja el neto en 0.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando faltantes...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
            No hay productos con faltante que producir.
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">En producción</TableHead>
                  <TableHead className="text-right w-32">A producir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.product_id}>
                    <TableCell className="font-medium">
                      {r.name}
                      {r.sku && <span className="text-muted-foreground"> · {r.sku}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-status-red">
                      {r.stock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.in_production}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={qty[r.product_id] ?? ""}
                        onChange={(e) =>
                          setQty((prev) => ({ ...prev, [r.product_id]: e.target.value }))
                        }
                        className="text-right"
                        inputMode="numeric"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={create.isPending || isLoading || rows.length === 0}
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Factory className="h-4 w-4 mr-1" />
            )}
            Crear lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
