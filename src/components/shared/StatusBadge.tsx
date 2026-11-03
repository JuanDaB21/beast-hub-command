import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "green" | "yellow" | "red" | "info" | "neutral";

interface StatusBadgeProps {
  /** Pasa `tone` directo, o `daysOverdue` para cálculo automático. */
  tone?: StatusTone;
  daysOverdue?: number;
  /** Umbrales para el cálculo semafórico (días). */
  warnThreshold?: number;
  dangerThreshold?: number;
  label: string;
  className?: string;
}

function toneFromDays(days: number, warn: number, danger: number): StatusTone {
  if (days >= danger) return "red";
  if (days >= warn) return "yellow";
  return "green";
}

const toneStyles: Record<StatusTone, string> = {
  green: "bg-success-soft text-success-ink",
  yellow: "bg-warning-soft text-warning-ink",
  red: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  tone,
  daysOverdue,
  warnThreshold = 3,
  dangerThreshold = 7,
  label,
  className,
}: StatusBadgeProps) {
  const resolvedTone =
    tone ??
    (typeof daysOverdue === "number"
      ? toneFromDays(daysOverdue, warnThreshold, dangerThreshold)
      : "neutral");

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap border-transparent px-2 font-medium", toneStyles[resolvedTone], className)}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
