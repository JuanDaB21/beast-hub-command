import { Card } from "@/components/ui/card";

/** Tarjeta de cifra del módulo de Logística (despacho y recaudo COD). */
export function KpiTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "yellow" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "text-status-red"
      : tone === "yellow"
        ? "text-status-yellow"
        : tone === "green"
          ? "text-status-green"
          : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
