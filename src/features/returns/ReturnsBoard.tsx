import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CheckCircle2, PackageX, ShieldCheck } from "lucide-react";
import { type ReturnRow } from "./api";
import { RETURN_STATUS_LABEL, returnStatusTone } from "./status";

interface Props {
  returns: ReturnRow[];
  onResolve: (ret: ReturnRow) => void;
}

const reasonTone: Record<string, string> = {
  Textil: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  Estampado: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  "Logística": "bg-orange-500/10 text-orange-600 border-orange-500/30",
  Inconformidad: "bg-pink-500/10 text-pink-600 border-pink-500/30",
};

export function ReturnsBoard({ returns, onResolve }: Props) {
  if (returns.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sin devoluciones registradas.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {returns.map((r) => (
        <ReturnCard key={r.id} ret={r} onResolve={() => onResolve(r)} />
      ))}
    </div>
  );
}

function ReturnCard({ ret, onResolve }: { ret: ReturnRow; onResolve: () => void }) {
  const isPending = ret.resolution_status === "pending";
  const date = new Date(ret.created_at);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted-foreground">
            {ret.order?.order_number ?? "Sin pedido"}
          </div>
          <div className="truncate text-base font-semibold">
            {ret.product?.name ?? "Producto eliminado"}
          </div>
          {ret.product?.sku && (
            <div className="font-mono text-xs text-muted-foreground">SKU {ret.product.sku}</div>
          )}
        </div>
        <StatusBadge
          tone={returnStatusTone(ret.resolution_status)}
          label={RETURN_STATUS_LABEL[ret.resolution_status]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className={reasonTone[ret.reason_category] ?? ""}>
          {ret.reason_category}
        </Badge>
        {ret.order?.customer_name && (
          <span className="text-muted-foreground">· {ret.order.customer_name}</span>
        )}
      </div>

      {ret.notes && (
        <div className="rounded-md bg-muted/50 p-2 text-xs">
          <div className="font-medium text-muted-foreground">Notas</div>
          <div className="line-clamp-3">{ret.notes}</div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Registrada {date.toLocaleDateString("es-MX")}</span>
        {ret.resolved_at && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {new Date(ret.resolved_at).toLocaleDateString("es-MX")}
          </span>
        )}
      </div>

      {isPending && (
        <Button size="sm" className="mt-auto gap-1.5" onClick={onResolve}>
          <PackageX className="h-4 w-4" />
          Resolver devolución
        </Button>
      )}
    </Card>
  );
}
