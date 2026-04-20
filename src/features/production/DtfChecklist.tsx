import { CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToggleWorkOrderItemDtf, type WorkOrderWithItems } from "./api";
import { toast } from "sonner";

interface Props {
  wo: WorkOrderWithItems;
}

export function DtfChecklist({ wo }: Props) {
  const toggle = useToggleWorkOrderItemDtf();
  const total = wo.items.length;
  const done = wo.items.filter((it) => it.is_dtf_added).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;

  const handleToggle = async (id: string, next: boolean) => {
    try {
      await toggle.mutateAsync({ id, is_dtf_added: next });
    } catch (err) {
      toast.error("No se pudo actualizar el DTF", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progreso DTF</span>
          <span className="font-medium tabular-nums">
            {done} / {total} ({pct}%)
          </span>
        </div>
        <Progress value={pct} />
      </div>

      {allDone && (
        <Alert className="border-primary/40 bg-primary/10">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Listo para imprimir</AlertTitle>
          <AlertDescription>
            Archivo de impresión consolidado y listo para DTF.
          </AlertDescription>
        </Alert>
      )}

      <ul className="divide-y rounded-md border">
        {wo.items.map((it) => {
          const checkboxId = `dtf-${it.id}`;
          return (
            <li key={it.id} className="flex items-center gap-3 p-3">
              <Checkbox
                id={checkboxId}
                checked={it.is_dtf_added}
                onCheckedChange={(v) => handleToggle(it.id, v === true)}
                disabled={toggle.isPending}
                className="h-5 w-5"
              />
              <label htmlFor={checkboxId} className="flex-1 min-w-0 cursor-pointer">
                <p
                  className={`font-medium truncate ${
                    it.is_dtf_added ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {it.product?.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{it.product?.sku ?? ""}</p>
              </label>
              <span className="text-sm font-semibold tabular-nums">
                ×{it.quantity_to_produce}
              </span>
            </li>
          );
        })}
        {wo.items.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground text-center">
            Este lote no tiene productos.
          </li>
        )}
      </ul>
    </div>
  );
}
