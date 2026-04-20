import type { StatusTone } from "@/components/shared/StatusBadge";
import type { ReturnStatus } from "./api";

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  pending: "Pendiente",
  restocked: "Re-ingresado",
  scrapped: "Merma",
};

export function returnStatusTone(s: ReturnStatus): StatusTone {
  switch (s) {
    case "pending":
      return "yellow";
    case "restocked":
      return "green";
    case "scrapped":
      return "red";
  }
}
