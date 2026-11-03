const copFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** Pesos colombianos sin decimales: $ 89.900 */
export const formatCOP = (n: number | string | null | undefined) => copFmt.format(Number(n ?? 0));

const rtf = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto", style: "short" });

/** "hace 3 h", "ayer", "hace 5 d" a partir de una fecha ISO. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diffMin = (new Date(iso).getTime() - Date.now()) / 60000;
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(Math.round(diffMin), "minute");
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), "hour");
  return rtf.format(Math.round(diffMin / (60 * 24)), "day");
}
