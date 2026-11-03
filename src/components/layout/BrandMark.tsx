import { cn } from "@/lib/utils";

/** Marca tipográfica Beast Club: bloque naranja + nombre condensado. */
export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand font-display text-xl font-bold leading-none text-brand-foreground">
        B
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-wide">Beast Club</span>
          <span className="text-2xs opacity-60">Hub Command</span>
        </div>
      )}
    </div>
  );
}
