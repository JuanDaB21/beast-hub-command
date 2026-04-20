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
}

export function ShipDialog({ order, open, onOpenChange }: Props) {
  const ship = useMarkShipped();
  const updateTracking = useUpdateTracking();

  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (order) {
      setTracking(order.tracking_number ?? "");
      setReason(order.delay_reason ?? "");
    }
  }, [order]);

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
        await updateTracking.mutateAsync({ id: order.id, tracking_number: tn });
        toast({ title: "Guía actualizada" });
      } else {
        await ship.mutateAsync({
          id: order.id,
          tracking_number: tn,
          delay_reason: requiresReason ? reason.trim() : null,
        });
        toast({ title: "Pedido despachado", description: `Guía ${tn} registrada.` });
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
            {pending ? "Guardando..." : isShipped ? "Guardar guía" : "Marcar como enviado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
