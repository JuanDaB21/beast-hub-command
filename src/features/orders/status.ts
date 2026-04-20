import type { StatusTone } from "@/components/shared/StatusBadge";
import type { OrderStatus } from "./api";

export function statusTone(s: OrderStatus): StatusTone {
  switch (s) {
    case "delivered":
      return "green";
    case "shipped":
      return "green";
    case "processing":
      return "yellow";
    case "pending":
      return "yellow";
    case "cancelled":
      return "red";
  }
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
