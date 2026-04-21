import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PackagePlus, Trash2 } from "lucide-react";
import { useResolveReturn, type ReturnRow } from "./api";
import { toast } from "@/hooks/use-toast";

interface Props {
  ret: ReturnRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function ResolveReturnDialog({ ret, open, onOpenChange }: Props) {
  const resolve = useResolveReturn();
  const [resolution, setResolution] = useState<"restocked" | "scrapped">("restocked");
  const [notes, setNotes] = useState("");
  const [companyAssumesShipping, setCompanyAssumesShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState<number>(0);

  useEffect(() => {
    if (ret) {
      setResolution("restocked");
      setNotes(ret.notes ?? "");
      setCompanyAssumesShipping(ret.company_assumes_shipping ?? false);
      setShippingCost(Number(ret.return_shipping_cost ?? 0));
    }
  }, [ret]);

  if (!ret) return null;

  const productCost = Number(ret.product?.cost ?? 0);

  const handleSubmit = async () => {
    if (notes.trim().length < 5) {
      toast({
        title: "Notas requeridas",
        description: "Explica brevemente la decisión (mín. 5 caracteres).",
        variant: "destructive",
      });
      return;
    }
    if (resolution === "restocked" && !ret.product_id) {
      toast({
        title: "Producto faltante",
        description: "No se puede re-ingresar al stock sin producto asociado.",
        variant: "destructive",
      });
      return;
    }
    try {
      await resolve.mutateAsync({
        id: ret.id,
        product_id: ret.product_id,
        current_stock: ret.product?.stock ?? 0,
        resolution,
        notes: notes.trim(),
        company_assumes_shipping: companyAssumesShipping,
        return_shipping_cost: companyAssumesShipping ? shippingCost : 0,
        product_cost: productCost,
        order_number: ret.order?.order_number ?? null,
        product_name: ret.product?.name ?? null,
      });

      const impacts: string[] = [];
      if (resolution === "scrapped" && productCost > 0) {
        impacts.push(`Merma: ${currency(productCost)}`);
      }
      if (companyAssumesShipping && shippingCost > 0) {
        impacts.push(`Flete asumido: ${currency(shippingCost)}`);
      }

      toast({
        title: resolution === "restocked" ? "Re-ingresado al stock" : "Marcado como merma",
        description: impacts.length > 0 ? `Impacto financiero · ${impacts.join(" · ")}` : "Sin impacto financiero adicional.",
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resolver devolución</DialogTitle>
          <DialogDescription>
            {ret.product?.name ?? "Producto"} · Pedido {ret.order?.order_number ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={resolution}
          onValueChange={(v) => setResolution(v as "restocked" | "scrapped")}
          className="space-y-2"
        >
          <label
            htmlFor="opt-restock"
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 hover:bg-muted/50 has-[:checked]:border-status-green has-[:checked]:bg-status-green/5"
          >
            <RadioGroupItem id="opt-restock" value="restocked" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium">
                <PackagePlus className="h-4 w-4 text-status-green" />
                Re-ingresar a stock maestro
              </div>
              <p className="text-xs text-muted-foreground">
                Suma +1 al inventario de {ret.product?.name ?? "este producto"} (stock actual:{" "}
                {ret.product?.stock ?? 0}).
              </p>
            </div>
          </label>

          <label
            htmlFor="opt-scrap"
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 hover:bg-muted/50 has-[:checked]:border-status-red has-[:checked]:bg-status-red/5"
          >
            <RadioGroupItem id="opt-scrap" value="scrapped" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium">
                <Trash2 className="h-4 w-4 text-status-red" />
                Descartar como merma
              </div>
              <p className="text-xs text-muted-foreground">
                Se asume la pérdida. Se registrará un gasto de {currency(productCost)} en el libro mayor.
              </p>
            </div>
          </label>
        </RadioGroup>

        {resolution === "scrapped" && (
          <Alert variant="destructive">
            <AlertDescription>
              Justifica el descarte: el producto se contabilizará como pérdida.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ras" className="text-sm">¿Asumimos el costo de envío?</Label>
              <p className="text-xs text-muted-foreground">
                Si activas esta opción, el flete se registrará como gasto.
              </p>
            </div>
            <Switch
              id="ras"
              checked={companyAssumesShipping}
              onCheckedChange={setCompanyAssumesShipping}
            />
          </div>
          {companyAssumesShipping && (
            <div className="space-y-1.5">
              <Label htmlFor="ship-cost" className="text-xs">Costo del envío de devolución</Label>
              <Input
                id="ship-cost"
                type="number"
                min="0"
                step="100"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resolve-notes">Comentario del operario *</Label>
          <Textarea
            id="resolve-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              resolution === "restocked"
                ? "Ej. Prenda en perfecto estado, etiqueta intacta."
                : "Ej. Mancha permanente en el estampado, no recuperable."
            }
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={resolve.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={resolve.isPending}>
            {resolve.isPending ? "Guardando..." : "Confirmar resolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
