import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import {
  RETURN_REASONS,
  useCreateReturn,
  useOrdersForReturns,
  type ReturnReason,
} from "./api";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSuccess?: () => void;
}

export function NewReturnForm({ onSuccess }: Props) {
  const { data: orders = [], isLoading } = useOrdersForReturns();
  const create = useCreateReturn();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [notes, setNotes] = useState("");

  const orderOptions = useMemo(
    () =>
      orders.map((o: any) => ({
        value: o.id,
        label: `${o.order_number} · ${o.customer_name}`,
      })),
    [orders],
  );

  const selectedOrder = orders.find((o: any) => o.id === orderId);
  const productOptions = useMemo(() => {
    if (!selectedOrder) return [];
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const it of (selectedOrder as any).items ?? []) {
      if (!it.product_id || !it.product) continue;
      if (seen.has(it.product_id)) continue;
      seen.add(it.product_id);
      opts.push({
        value: it.product_id,
        label: `${it.product.sku} · ${it.product.name}`,
      });
    }
    return opts;
  }, [selectedOrder]);

  const reasonOptions = RETURN_REASONS.map((r) => ({ value: r, label: r }));

  const handleOrderChange = (v: string | null) => {
    setOrderId(v);
    setProductId(null);
  };

  const handleSubmit = async () => {
    if (!orderId || !productId || !reason) {
      toast({
        title: "Faltan datos",
        description: "Selecciona pedido, producto y motivo.",
        variant: "destructive",
      });
      return;
    }
    try {
      await create.mutateAsync({
        order_id: orderId,
        product_id: productId,
        reason_category: reason,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Devolución registrada" });
      onSuccess?.();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Pedido *</Label>
        <StandardCombobox
          options={orderOptions}
          value={orderId}
          onChange={handleOrderChange}
          placeholder={isLoading ? "Cargando pedidos..." : "Selecciona pedido"}
          searchPlaceholder="Buscar por # pedido o cliente..."
          emptyText="Sin pedidos"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Producto devuelto *</Label>
        <StandardCombobox
          options={productOptions}
          value={productId}
          onChange={setProductId}
          placeholder={
            !orderId
              ? "Primero selecciona un pedido"
              : productOptions.length === 0
                ? "Este pedido no tiene productos"
                : "Selecciona producto"
          }
          searchPlaceholder="Buscar producto..."
          disabled={!orderId || productOptions.length === 0}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Motivo *</Label>
        <StandardCombobox
          options={reasonOptions}
          value={reason}
          onChange={(v) => setReason(v as ReturnReason | null)}
          placeholder="Selecciona motivo"
          searchPlaceholder="Buscar..."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas iniciales (opcional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Detalles que reportó el cliente..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSubmit} disabled={create.isPending}>
          {create.isPending ? "Registrando..." : "Registrar devolución"}
        </Button>
      </div>
    </div>
  );
}
