import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "green" | "yellow" | "red" | "neutral";

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
  green: "bg-status-green/15 text-status-green border-status-green/30",
  yellow: "bg-status-yellow/15 text-status-yellow border-status-yellow/40",
  red: "bg-status-red/15 text-status-red border-status-red/30",
  neutral: "bg-muted text-muted-foreground border-border",
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
    <Badge variant="outline" className={cn("font-medium", toneStyles[resolvedTone], className)}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
