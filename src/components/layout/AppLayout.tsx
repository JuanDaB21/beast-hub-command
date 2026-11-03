import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { QuoteCalculatorSheet } from "@/features/sales/QuoteCalculatorSheet";
import { AppSidebar } from "./AppSidebar";
import { CommandMenu } from "./CommandMenu";
import { MobileBottomNav } from "./MobileBottomNav";
import { ShellContext } from "./ShellContext";

/** Shell persistente de las rutas protegidas: no se remonta al navegar. */
export function AppLayout() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shell = useMemo(
    () => ({ openCommand: () => setCommandOpen(true), openQuote: () => setQuoteOpen(true) }),
    [],
  );

  return (
    <ShellContext.Provider value={shell}>
      <SidebarProvider>
        <div className="flex min-h-svh w-full bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
        <MobileBottomNav />
        <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} onOpenQuote={shell.openQuote} />
        <QuoteCalculatorSheet open={quoteOpen} onOpenChange={setQuoteOpen} />
      </SidebarProvider>
    </ShellContext.Provider>
  );
}
