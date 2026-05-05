import { useMemo, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWorkOrders } from "@/features/production/api";
import { NewWorkOrderForm } from "@/features/production/NewWorkOrderForm";
import { WorkOrdersBoard } from "@/features/production/WorkOrdersBoard";
import { RecipeManager } from "@/features/production/RecipeManager";

function KPI({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function Production() {
  const { data: workOrders = [], isLoading } = useWorkOrders();
  const [open, setOpen] = useState(false);

  const kpis = useMemo(() => {
    const pending = workOrders.filter((w) => w.status === "pending").length;
    const inProgress = workOrders.filter((w) => w.status === "in_progress").length;
    const completed = workOrders.filter((w) => w.status === "completed").length;
    const totalProducedUnits = workOrders
      .filter((w) => w.status === "completed")
      .reduce((s, w) => s + w.items.reduce((a, i) => a + i.quantity_to_produce, 0), 0);
    return { pending, inProgress, completed, totalProducedUnits };
  }, [workOrders]);

  return (
    <AppShell
      title="Producción"
      description="Gestiona lotes (Órdenes de Trabajo) y recetas (BOM) de tus productos."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nuevo lote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl lg:max-w-4xl w-[95vw]">
            <DialogHeader>
              <DialogTitle>Nuevo lote de producción</DialogTitle>
            </DialogHeader>
            <NewWorkOrderForm onCreated={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Pendientes" value={kpis.pending} />
          <KPI label="En proceso" value={kpis.inProgress} />
          <KPI label="Completados" value={kpis.completed} />
          <KPI label="Unidades producidas" value={kpis.totalProducedUnits} hint="En lotes completados" />
        </div>

        <Tabs defaultValue="lotes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lotes">Lotes</TabsTrigger>
            <TabsTrigger value="recetas">Recetas (BOM)</TabsTrigger>
          </TabsList>

          <TabsContent value="lotes">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando lotes...
              </div>
            ) : (
              <WorkOrdersBoard workOrders={workOrders} />
            )}
          </TabsContent>

          <TabsContent value="recetas">
            <RecipeManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
