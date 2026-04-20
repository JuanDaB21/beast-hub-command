import type { SupplyRequestStatus } from "./api";
import type { StatusTone } from "@/components/shared/StatusBadge";

export function supplyRequestTone(status: SupplyRequestStatus): StatusTone {
  switch (status) {
    case "pending":
      return "warning";
    case "partial":
      return "warning";
    case "confirmed":
      return "success";
    case "delivered":
      return "info";
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
    case "delivered":
      return "Entregado";
    default:
      return status;
  }
}
