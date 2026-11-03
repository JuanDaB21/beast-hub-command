import { ReactNode } from "react";
import { Calculator, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useShell } from "./ShellContext";

interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Encabezado + área de contenido de una página. El layout persistente
 * (sidebar, barra móvil, paleta) vive en `AppLayout`.
 */
export function AppShell({ title, description, actions, children }: AppShellProps) {
  const { openCommand, openQuote } = useShell();

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-safe backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-4 md:h-16 md:gap-3 md:px-6">
          <SidebarTrigger className="hidden md:inline-flex" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[1.625rem] font-semibold leading-none md:text-[1.875rem]">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 hidden truncate text-xs text-muted-foreground md:block">{description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            {actions}
            <Button
              type="button"
              variant="outline"
              onClick={openCommand}
              className="hidden h-9 w-44 justify-between px-3 font-normal text-muted-foreground lg:flex"
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar
              </span>
              <kbd className="rounded border bg-muted px-1.5 text-2xs">Ctrl K</kbd>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openQuote}
              aria-label="Calculadora de cotización"
              title="Calculadora de cotización"
            >
              <Calculator className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 pb-bottom-nav pt-4 md:px-6 md:pb-8 md:pt-6">{children}</main>
    </>
  );
}
