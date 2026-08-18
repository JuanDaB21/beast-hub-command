import { useMemo, useState } from "react";
import { Plus, Loader2, PackagePlus, Send, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWorkOrders } from "@/features/production/api";
import { NewWorkOrderForm } from "@/features/production/NewWorkOrderForm";
import { NegativeStockBatchDialog } from "@/features/production/NegativeStockBatchDialog";
import { WorkOrdersBoard } from "@/features/production/WorkOrdersBoard";
import { RecipeManager } from "@/features/production/RecipeManager";
import {
  ProductionRequirementsSummary,
  type DraftLine,
} from "@/features/production/RequirementsSummary";
import { useGenerateUnifiedSupply } from "@/features/supply-requests/api";
import type { WorkOrderWithItems } from "@/features/production/api";

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

/**
 * Diálogo que previsualiza la necesidad total de bases sumada sobre TODOS los
 * lotes activos (En proceso + Pendientes) y dispara la generación de una
 * solicitud unificada por proveedor (margen 20%, idempotente).
 */
function UnifiedSupplyDialog({ workOrders }: { workOrders: WorkOrderWithItems[] }) {
  const [open, setOpen] = useState(false);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const generate = useGenerateUnifiedSupply();

  const activeItems = useMemo<DraftLine[]>(
    () =>
      workOrders
        .filter((w) => w.status === "in_progress" || w.status === "pending")
        .flatMap((w) =>
          w.items.map((i) => ({
            product_id: i.product_id,
            quantity_to_produce: i.quantity_to_produce,
          })),
        ),
    [workOrders],
  );

  const handleGenerate = async () => {
    try {
      const res = await generate.mutateAsync();
      setGeneratedIds(res.request_ids);
      if (res.request_ids.length === 0) {
        toast.info("Sin faltantes", {
          description: "El stock cubre la necesidad de todos los lotes activos.",
        });
      } else {
        toast.success("Solicitud unificada generada", {
          description: `${res.suppliers.length} proveedor(es) · ${res.created} nueva(s), ${res.updated} actualizada(s) · ${res.total_units} unidades`,
        });
      }
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setGeneratedIds([]);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PackagePlus className="h-4 w-4 mr-1" /> Solicitud unificada de bases
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Solicitud unificada de bases</DialogTitle>
          <DialogDescription>
            Necesidad total sumada sobre todos los lotes En proceso y Pendientes, menos el
            stock actual. Se genera una solicitud por proveedor con margen del 20%.
          </DialogDescription>
        </DialogHeader>

        {activeItems.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
            No hay lotes activos (En proceso o Pendientes) con productos.
          </div>
        ) : (
          <ProductionRequirementsSummary items={activeItems} />
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {generatedIds.length > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/solicitudes">
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver solicitud{generatedIds.length > 1 ? "es" : ""}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generate.isPending || activeItems.length === 0}
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Generar solicitud unificada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <div className="flex flex-wrap items-center gap-2">
          <NegativeStockBatchDialog />
          <UnifiedSupplyDialog workOrders={workOrders} />
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
        </div>
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
