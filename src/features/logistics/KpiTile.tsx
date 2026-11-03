import { StatTile } from "@/components/shared/StatTile";

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
  return <StatTile label={label} value={value} hint={hint} tone={tone} size="compact" />;
}
