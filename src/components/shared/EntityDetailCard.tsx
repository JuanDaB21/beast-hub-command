import { ReactNode, useState } from "react";
import { Card } from "@/components/ui/card";
import { DetailPanel } from "./DetailPanel";
import { cn } from "@/lib/utils";

interface EntityDetailCardProps {
  title: string;
  subtitle?: string;
  /** Contenido siempre visible en la tarjeta (resumen). */
  summary: ReactNode;
  /** Contenido del panel de detalle al hacer click. */
  details: ReactNode;
  /** Nombre de la entidad para encabezado del panel. */
  detailsTitle?: string;
  detailsDescription?: string;
  className?: string;
}

/**
 * Card clickeable que abre el detalle completo de una entidad:
 * hoja inferior en móvil, panel lateral derecho en desktop.
 */
export function EntityDetailCard({
  title,
  subtitle,
  summary,
  details,
  detailsTitle,
  detailsDescription,
  className,
}: EntityDetailCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "cursor-pointer p-3.5 transition-[border-color,background-color] duration-fast ease-out-quint hover:border-foreground/25 active:bg-surface-2",
          className,
        )}
      >
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[0.9375rem] font-semibold leading-tight">{title}</h3>
          {subtitle && <span className="tabular shrink-0 text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <div className="text-sm text-muted-foreground">{summary}</div>
      </Card>

      <DetailPanel open={open} onOpenChange={setOpen} title={detailsTitle ?? title} description={detailsDescription}>
        {details}
      </DetailPanel>
    </>
  );
}
