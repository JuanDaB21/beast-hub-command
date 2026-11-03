import { type LucideIcon } from "lucide-react";
import { StatTile } from "@/components/shared/StatTile";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "green" | "yellow" | "red" | "primary";
  size?: "hero" | "default" | "compact";
  className?: string;
}

/** KPI del dashboard; delega en el `StatTile` compartido. */
export function KpiCard({ tone = "default", ...props }: KpiCardProps) {
  return <StatTile tone={tone === "primary" ? "brand" : tone} {...props} />;
}
