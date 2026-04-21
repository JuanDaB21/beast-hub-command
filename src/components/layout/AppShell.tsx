import { ReactNode, useState } from "react";
import { Calculator } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuoteCalculatorSheet } from "@/features/sales/QuoteCalculatorSheet";

interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const [quoteOpen, setQuoteOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-6">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
              {description && (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setQuoteOpen(true)}
                      aria-label="Calculadora de cotización"
                    >
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Calculadora de cotización</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {actions}
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6">{children}</main>
        </div>
        <QuoteCalculatorSheet open={quoteOpen} onOpenChange={setQuoteOpen} />
      </div>
    </SidebarProvider>
  );
}
