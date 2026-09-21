import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { toast } from "@/hooks/use-toast";
import { useMergeProduct, useProducts, type Product } from "./api";

interface Props {
  source: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Fusiona una variante duplicada dentro de la correcta. Es la vía para eliminar una
 * variante que ya tiene pedidos u órdenes de trabajo: el borrado directo falla por las
 * claves foráneas o dejaría la venta sin producto.
 */
export function MergeVariantDialog({ source, open, onOpenChange }: Props) {
  const { data: products = [] } = useProducts();
  const merge = useMergeProduct();
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTargetId(null);
  }, [open, source?.id]);

  const siblings = useMemo(() => {
    if (!source) return [];
    return products
      .filter((p) => !p.is_parent && p.id !== source.id && p.parent_id === source.parent_id)
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }, [products, source]);

  const options = useMemo(
    () => siblings.map((p) => ({ value: p.id, label: p.name, sublabel: p.sku })),
    [siblings],
  );

  const target = siblings.find((p) => p.id === targetId) ?? null;

  const onConfirm = async () => {
    if (!source || !targetId) return;
    try {
      const res = await merge.mutateAsync({ sourceId: source.id, targetId });
      const { order_items, work_order_items, returns } = res.moved;
      toast({
        title: "Variante fusionada",
        description:
          `Movidos: ${order_items} línea(s) de pedido, ${work_order_items} ítem(s) de OT, ` +
          `${returns} devolución(es). Ajuste de stock: ${res.stock_delta}.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fusionar variante</DialogTitle>
          <DialogDescription>
            El historial de la variante de abajo se mueve a la que elijas y la variante
            original se elimina.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Se elimina</Label>
            <div className="mt-1 rounded-md border p-2">
              <div className="text-sm">{source?.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{source?.sku}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="merge-target">Se conserva</Label>
            <div className="mt-1">
              <StandardCombobox
                options={options}
                value={targetId}
                onChange={setTargetId}
                placeholder="Elegir la variante correcta..."
                searchPlaceholder="Buscar por nombre o SKU..."
                emptyText="No hay otras variantes en este producto"
                wrapLabel
              />
            </div>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Los pedidos, órdenes de trabajo y devoluciones pasan a{" "}
              {target ? <span className="font-mono">{target.sku}</span> : "la variante elegida"},
              junto con el stock que tenían reservado o producido. No se puede deshacer.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merge.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!targetId || merge.isPending}>
            {merge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fusionar y eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
