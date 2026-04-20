import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { MODULES } from "@/lib/modules";

interface Props {
  slug: string;
}

export default function ModulePlaceholder({ slug }: Props) {
  const mod = MODULES.find((m) => m.slug === slug);
  if (!mod) return null;
  return (
    <AppShell title={mod.title} description="Módulo planificado para fases posteriores.">
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Construction className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">{mod.title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Este módulo aún no se ha construido. La Fase 1 entrega únicamente el App Shell, los
          componentes reutilizables y el Módulo 3 · Sourcing.
        </p>
      </Card>
    </AppShell>
  );
}
