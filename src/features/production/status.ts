import type { StatusTone } from "@/components/shared/StatusBadge";
import type { WorkOrderStatus } from "./api";

export function workOrderTone(status: WorkOrderStatus): StatusTone {
  switch (status) {
    case "pending":
      return "yellow";
    case "in_progress":
      return "yellow";
    case "completed":
      return "green";
    case "cancelled":
      return "red";
  }
}

export function workOrderLabel(status: WorkOrderStatus): string {
  return (
    {
      pending: "Pendiente",
      in_progress: "En proceso",
      completed: "Completado",
      cancelled: "Cancelado",
    } as const
  )[status];
}
