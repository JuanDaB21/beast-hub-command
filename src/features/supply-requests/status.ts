import type { SupplyRequestStatus } from "./api";
import type { StatusTone } from "@/components/shared/StatusBadge";

export function supplyRequestTone(status: SupplyRequestStatus): StatusTone {
  switch (status) {
    case "pending":
      return "yellow";
    case "partial":
      return "yellow";
    case "confirmed":
      return "green";
    case "receiving":
      return "yellow";
    case "delivered":
      return "neutral";
    default:
      return "neutral";
  }
}

export function supplyRequestLabel(status: SupplyRequestStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "partial":
      return "Parcial";
    case "confirmed":
      return "Confirmado";
    case "receiving":
      return "En recepción";
    case "delivered":
      return "Entregado";
    default:
      return status;
  }
}
