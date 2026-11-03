import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fila de KPIs: tira deslizable con snap en móvil (no empuja el contenido
 * hacia abajo) y grilla en desktop. `cols` = columnas en lg.
 */
export function StatStrip({ children, cols = 4, className }: { children: ReactNode; cols?: 3 | 4 | 5 | 6; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none",
        "[&>*]:w-[44%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[30%]",
        "md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0 md:[&>*]:w-auto",
        cols === 3 && "md:grid-cols-3",
        cols === 4 && "md:grid-cols-2 lg:grid-cols-4",
        cols === 5 && "md:grid-cols-3 lg:grid-cols-5",
        cols === 6 && "md:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
