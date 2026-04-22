import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderWithItems } from "@/features/orders/api";

export interface ShipmentOrder extends OrderWithItems {
  tracking_number: string | null;
  shipped_at: string | null;
  delay_reason: string | null;
  shipping_cost: number;
  customer_pays_shipping: boolean;
}

const QK = ["logistics-orders"] as const;

/** Pedidos en flujo logístico: pending, processing, shipped. */
export function useShipmentOrders() {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.get<ShipmentOrder[]>("/logistics/orders"),
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
