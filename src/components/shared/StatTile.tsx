import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "brand" | "green" | "yellow" | "red";

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  /** `hero`: la cifra protagonista de la vista. `compact`: filas densas. */
  size?: "hero" | "default" | "compact";
  className?: string;
}

const valueTone: Record<StatTone, string> = {
  default: "text-foreground",
  brand: "text-brand-ink",
  green: "text-success",
  yellow: "text-warning-ink dark:text-warning",
  red: "text-danger",
};

const barTone: Record<StatTone, string> = {
  default: "bg-transparent",
  brand: "bg-brand",
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-danger",
};

const valueSize = {
  hero: "text-[2.75rem] sm:text-[3.5rem]",
  default: "text-[1.75rem] sm:text-[2.125rem]",
  compact: "text-[1.5rem] sm:text-[1.75rem]",
};

/** Cifra clave. Las cifras son el elemento protagonista del sistema: Khand condensada. */
export function StatTile({ label, value, hint, icon: Icon, tone = "default", size = "default", className }: StatTileProps) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card",
        size === "compact" ? "p-3" : "p-3.5 sm:p-4",
        size === "hero" && "bg-surface-2",
        className,
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", barTone[tone])} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-snug text-muted-foreground sm:text-[0.8125rem]">{label}</span>
        {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
      </div>
      <span
        className={cn(
          "tabular mt-1 truncate font-display font-semibold leading-[0.95] tracking-tight",
          valueSize[size],
          valueTone[tone],
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</span>}
    </div>
  );
}
