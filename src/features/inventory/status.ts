import type { StatusTone } from "@/components/shared/StatusBadge";
import type { Product } from "./api";

export interface StockStatus {
  tone: StatusTone;
  label: string;
}

/** Reglas semafóricas de stock vs safety_stock. */
export function getStockStatus(p: Pick<Product, "stock" | "safety_stock">): StockStatus {
  if (p.stock <= 0) return { tone: "red", label: "Agotado" };
  if (p.stock <= p.safety_stock) return { tone: "yellow", label: "Stock crítico" };
  return { tone: "green", label: "Óptimo" };
}

export const AGING_THRESHOLD_DAYS = 45;

export function isAgingFlagged(p: Pick<Product, "aging_days">): boolean {
  return p.aging_days > AGING_THRESHOLD_DAYS;
}
