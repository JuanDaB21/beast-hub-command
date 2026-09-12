import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderWithItems } from "@/features/orders/api";

/**
 * El feed de Logística devuelve la orden completa (o.* + items), así que no hay
 * nada que añadir sobre OrderWithItems. Se conserva el nombre porque los
 * componentes del módulo hablan de "envíos".
 */
export type ShipmentOrder = OrderWithItems;

const QK = ["logistics-orders"] as const;

/**
 * Pedidos del flujo logístico: pending, processing y shipped, más los COD ya
 * entregados mientras su recaudo siga abierto (son la plata que la
 * transportadora todavía no ha girado).
 */
export function useShipmentOrders() {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.get<ShipmentOrder[]>("/logistics/orders"),
  });
}

/* ---- COD ----
 * El recaudo se cierra solo al entregar (el servidor lo deriva del status), así
 * que la única acción COD que queda es la confirmación previa al despacho.
 */

/** Etapas del ciclo COD, para agrupar el tablero de recaudo. */
export type CodStage = "to_confirm" | "to_collect" | "collected";

/**
 * Solo los COD de Shopify pasan por confirmación telefónica: los manuales se
 * toman por teléfono, así que ya nacen confirmados de hecho.
 */
export function needsOrderConfirmation(o: ShipmentOrder) {
  return o.is_cod && o.source === "shopify" && !o.order_confirmed && !o.cod_confirmed;
}

export function codStage(o: ShipmentOrder): CodStage {
  if (o.cod_confirmed) return "collected";
  return needsOrderConfirmation(o) ? "to_confirm" : "to_collect";
}

/** Hito 1: el cliente confirmó que sí quiere el pedido. Previo al despacho. */
export function useConfirmCodOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/cod/orders/${id}/confirm`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export interface ShipPayload {
  id: string;
  tracking_number: string;
  shipping_cost: number;
  delay_reason?: string | null;
  target_status?: "shipped" | "delivered";
}

export function useMarkShipped() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tracking_number, shipping_cost, delay_reason, target_status }: ShipPayload) =>
      api.patch(`/orders/${id}`, {
        tracking_number,
        shipping_cost,
        shipped_at: new Date().toISOString(),
        status: target_status ?? "shipped",
        delay_reason: delay_reason ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/**
 * Marca un pedido como entregado. En los COD esto además cierra el recaudo: el
 * servidor setea cod_confirmed y su timestamp, porque si la transportadora
 * entregó, cobró.
 */
export function useMarkDelivered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}`, { status: "delivered" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["finance_reconciliation"] });
    },
  });
}

export function useUpdateTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      tracking_number,
      shipping_cost,
    }: {
      id: string;
      tracking_number: string;
      shipping_cost?: number;
    }) =>
      api.patch(`/orders/${id}`,
        typeof shipping_cost === "number"
          ? { tracking_number, shipping_cost }
          : { tracking_number },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useUpdateShippingCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, shipping_cost }: { id: string; shipping_cost: number }) =>
      api.patch(`/orders/${id}`, { shipping_cost }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/* ---- SLA helpers ---- */

export type SlaTone = "green" | "yellow" | "red";

export function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

export function slaFromCreatedAt(iso: string): { tone: SlaTone; label: string; hours: number; days: number } {
  const hours = hoursSince(iso);
  const days = Math.floor(hours / 24);
  if (hours < 48) return { tone: "green", label: `Día ${days + 1} · Estándar`, hours, days };
  if (hours < 72) return { tone: "yellow", label: "Día 3 · Prioridad", hours, days };
  return { tone: "red", label: `Día ${days + 1} · Retraso crítico`, hours, days };
}
