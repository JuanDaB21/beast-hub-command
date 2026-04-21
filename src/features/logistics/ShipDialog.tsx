import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, PackageCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  slaFromCreatedAt,
  useMarkShipped,
  useUpdateTracking,
  type ShipmentOrder,
} from "./api";

interface Props {
  order: ShipmentOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetStatus?: "shipped" | "delivered";
}

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export function ShipDialog({ order, open, onOpenChange, targetStatus = "shipped" }: Props) {
  const ship = useMarkShipped();
  const updateTracking = useUpdateTracking();

  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const [shippingCost, setShippingCost] = useState<string>("");

  useEffect(() => {
    if (order) {
      setTracking(order.tracking_number ?? "");
      setReason(order.delay_reason ?? "");
      setShippingCost(order.shipping_cost ? String(order.shipping_cost) : "");
    }
  }, [order]);

  const tentativeMargin = useMemo(() => {
    if (!order) return 0;
    const cost = Number(shippingCost) || 0;
    return Number(order.total) - cost;
  }, [order, shippingCost]);

  if (!order) return null;

  const sla = slaFromCreatedAt(order.created_at);
  const requiresReason = sla.tone === "red";
  const isShipped = order.status === "shipped";

  const handleSubmit = async () => {
    const tn = tracking.trim();
    if (!tn) {
      toast({ title: "Falta la guía", description: "Captura el tracking number.", variant: "destructive" });
      return;
    }
    const costNum = Number(shippingCost);
    if (shippingCost === "" || Number.isNaN(costNum) || costNum < 0) {
      toast({
        title: "Costo de envío inválido",
        description: "Captura un costo de envío válido (≥ 0).",
        variant: "destructive",
      });
      return;
    }
    if (requiresReason && reason.trim().length < 5 && !isShipped) {
      toast({
        title: "Motivo requerido",
        description: "Captura el motivo del retraso (mín. 5 caracteres).",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isShipped) {
        await updateTracking.mutateAsync({
          id: order.id,
          tracking_number: tn,
          shipping_cost: costNum,
        });
        toast({ title: "Guía actualizada" });
      } else {
        await ship.mutateAsync({
          id: order.id,
          tracking_number: tn,
          shipping_cost: costNum,
          delay_reason: requiresReason ? reason.trim() : null,
          target_status: targetStatus,
        });
        toast({
          title: targetStatus === "delivered" ? "Pedido entregado" : "Pedido despachado",
          description: `Guía ${tn} registrada.`,
        });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const pending = ship.isPending || updateTracking.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            {isShipped ? "Actualizar guía" : "Despachar pedido"}
          </DialogTitle>
          <DialogDescription>
            {order.order_number} · {order.customer_name}
          </DialogDescription>
        </DialogHeader>

        {requiresReason && !isShipped && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Retraso crítico</AlertTitle>
            <AlertDescription>
              Este pedido lleva más de 72h. Debes registrar el motivo del retraso.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tracking">Guía Inter Rapidísimo</Label>
            <Input
              id="tracking"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Ej. 240012345678"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shipping_cost">Costo de envío (COP) *</Label>
            <Input
              id="shipping_cost"
              type="number"
              min={0}
              step="100"
              inputMode="numeric"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              placeholder="Ej. 12000"
            />
            <p className="text-xs text-muted-foreground">
              Se restará del margen del pedido.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pedido</span>
              <span className="tabular-nums font-medium">{currency(Number(order.total))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo de envío</span>
              <span className="tabular-nums font-medium">-{currency(Number(shippingCost) || 0)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1">
              <span className="text-muted-foreground">Total - envío</span>
              <span className="tabular-nums font-semibold">{currency(tentativeMargin)}</span>
            </div>
          </div>

          {requiresReason && !isShipped && (
            <div className="space-y-1.5">
              <Label htmlFor="reason">Motivo del retraso *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Falta de stock, cliente no contestó, etc."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Guardando..." : isShipped ? "Guardar cambios" : "Marcar como enviado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
