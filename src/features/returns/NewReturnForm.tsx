import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
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
    // Pre-marca todos los productos del pedido; el usuario desmarca los que no se devuelven.
    const order = orders.find((o: any) => o.id === v);
    const ids = new Set<string>();
    for (const it of ((order as any)?.items ?? []) as any[]) {
      if (it.product_id && it.product) ids.add(it.product_id);
    }
    setSelectedProductIds(ids);
  };

  const toggleProduct = (pid: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!orderId || selectedProductIds.size === 0 || !reason) {
      toast({
        title: "Faltan datos",
        description: "Selecciona pedido, al menos un producto y motivo.",
        variant: "destructive",
      });
      return;
    }
    try {
      const productIds = [...selectedProductIds];
      const result = await create.mutateAsync({
        order_id: orderId,
        product_ids: productIds,
        reason_category: reason,
        notes: notes.trim() || undefined,
      });
      const cancelled = result?.cancelled_orders ?? [];
      toast({
        title:
          productIds.length === 1
            ? "Devolución registrada"
            : `${productIds.length} devoluciones registradas`,
        description: cancelled.length
          ? `Pedido ${cancelled.map((o) => o.order_number).join(", ")} cancelado: se devolvió completo y aún no estaba cobrado.`
          : undefined,
      });
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
          wrapLabel
        />
      </div>

      <div className="space-y-1.5">
        <Label>Producto(s) devuelto(s) *</Label>
        {!orderId ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Primero selecciona un pedido.
          </p>
        ) : productOptions.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Este pedido no tiene productos.
          </p>
        ) : (
          <div className="space-y-1 rounded-md border p-1">
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Todos marcados por defecto. Desmarca los que el cliente no devolvió.
            </p>
            {productOptions.map((opt) => {
              const checked = selectedProductIds.has(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleProduct(opt.value)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-sm leading-snug break-words">{opt.label}</span>
                </label>
              );
            })}
          </div>
        )}
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
