import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "green" | "yellow" | "red" | "primary";
}

const toneClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  green: "text-status-green",
  yellow: "text-status-yellow",
  red: "text-status-red",
};

const toneBg: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/10 text-primary",
  green: "bg-status-green/10 text-status-green",
  yellow: "bg-status-yellow/10 text-status-yellow",
  red: "bg-status-red/10 text-status-red",
};

export function KpiCard({ label, value, hint, icon: Icon, tone = "default" }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className={cn("mt-1 text-2xl font-bold tabular-nums sm:text-3xl", toneClasses[tone])}>
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", toneBg[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
