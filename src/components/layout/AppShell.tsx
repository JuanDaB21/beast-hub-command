import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";

interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
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
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
          <main className="flex-1 p-3 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
