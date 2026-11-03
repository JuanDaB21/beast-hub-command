import { EntityDetailCard } from "@/components/shared/EntityDetailCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { WorkOrderWithItems } from "./api";
import { workOrderLabel, workOrderTone } from "./status";
import { WorkOrderDetails } from "./WorkOrderDetails";

interface Props {
  workOrders: WorkOrderWithItems[];
}

export function WorkOrdersBoard({ workOrders }: Props) {
  if (!workOrders.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aún no hay lotes de producción. Crea uno para comenzar.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {workOrders.map((wo) => {
        const totalUnits = wo.items.reduce((s, it) => s + it.quantity_to_produce, 0);
        return (
          <EntityDetailCard
            key={wo.id}
            title={wo.batch_number}
            subtitle={wo.target_date ? `Objetivo ${new Date(wo.target_date).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}` : "Sin fecha objetivo"}
            summary={
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <StatusBadge tone={workOrderTone(wo.status)} label={workOrderLabel(wo.status)} />
                  <span className="tabular font-display text-xl font-semibold leading-none text-foreground">{totalUnits} u.</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {wo.items.length} producto{wo.items.length === 1 ? "" : "s"}
                </p>
              </div>
            }
            detailsTitle={`Lote ${wo.batch_number}`}
            details={<WorkOrderDetails wo={wo} />}
          />
        );
      })}
    </div>
  );
}
