import { ReactNode, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface EntityDetailCardProps {
  title: string;
  subtitle?: string;
  /** Contenido siempre visible en la tarjeta (resumen). */
  summary: ReactNode;
  /** Contenido del Drawer al hacer click. */
  details: ReactNode;
  /** Nombre de la entidad para encabezado del drawer. */
  detailsTitle?: string;
  detailsDescription?: string;
  className?: string;
}

/** Card clickeable que abre un Drawer con los detalles completos de una entidad. */
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
          "cursor-pointer p-4 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-semibold">{title}</h3>
          {subtitle && <span className="shrink-0 text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <div className="text-sm text-muted-foreground">{summary}</div>
      </Card>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden">
            <DrawerHeader className="shrink-0">
              <DrawerTitle>{detailsTitle ?? title}</DrawerTitle>
              {detailsDescription && <DrawerDescription>{detailsDescription}</DrawerDescription>}
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">{details}</div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
