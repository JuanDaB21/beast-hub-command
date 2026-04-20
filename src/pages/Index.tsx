import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { MODULES } from "@/lib/modules";
import { ArrowRight } from "lucide-react";

export default function Index() {
  return (
    <AppShell
      title="Beast Club · Command Center"
      description="Vista general — Fase 1: Sourcing operativo."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MODULES.filter((m) => m.id !== 0).map((m) => {
          const isReady = m.slug === "sourcing";
          return (
            <Link key={m.slug} to={m.path} className="group">
              <Card className="flex h-full flex-col gap-3 p-4 transition-colors group-hover:border-primary/50 group-hover:bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      isReady
                        ? "bg-status-green/15 text-status-green"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isReady ? "Activo" : "Próximamente"}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold leading-tight">{m.title}</h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                  Abrir <ArrowRight className="h-3 w-3" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
