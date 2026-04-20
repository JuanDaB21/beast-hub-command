import { useMemo, useState } from "react";
import { Plus, Copy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityDetailCard } from "@/components/shared/EntityDetailCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useSupplyRequests } from "@/features/supply-requests/api";
import { supplyRequestLabel, supplyRequestTone } from "@/features/supply-requests/status";
import { NewSupplyRequestForm } from "@/features/supply-requests/NewSupplyRequestForm";
import { SupplyRequestDetails } from "@/features/supply-requests/SupplyRequestDetails";
import { toast } from "sonner";

export default function SupplyRequests() {
  const [open, setOpen] = useState(false);
  const { data: requests, isLoading } = useSupplyRequests();

  const kpis = useMemo(() => {
    const list = requests ?? [];
    return {
      total: list.length,
      pending: list.filter((r) => r.status === "pending").length,
      partial: list.filter((r) => r.status === "partial").length,
      confirmed: list.filter((r) => r.status === "confirmed").length,
    };
  }, [requests]);

  const headerActions = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva solicitud</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva solicitud a proveedor</DialogTitle>
          <DialogDescription>
            Selecciona el proveedor y los insumos que necesitas confirmar.
          </DialogDescription>
        </DialogHeader>
        <NewSupplyRequestForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );

  return (
    <AppShell
      title="Solicitudes a Proveedor"
      description="Genera enlaces seguros para que tus proveedores confirmen disponibilidad."
      actions={headerActions}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <Kpi label="Total" value={kpis.total} />
        <Kpi label="Pendientes" value={kpis.pending} tone="yellow" />
        <Kpi label="Parciales" value={kpis.partial} tone="yellow" />
        <Kpi label="Confirmadas" value={kpis.confirmed} tone="green" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : !requests?.length ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center">
          <h3 className="text-base font-semibold">Sin solicitudes aún</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea una nueva solicitud para enviarla a un proveedor por WhatsApp.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((r) => {
            const portalUrl = `${window.location.origin}/supplier/${r.secure_token}`;
            const copyUrl = async (e: React.MouseEvent) => {
              e.stopPropagation();
              try {
                await navigator.clipboard.writeText(portalUrl);
                toast.success("URL copiada");
              } catch {
                toast.error("No se pudo copiar");
              }
            };
            return (
              <EntityDetailCard
                key={r.id}
                title={r.supplier?.name ?? "—"}
                subtitle={`${r.items.length} insumo(s)`}
                detailsTitle={`Solicitud · ${r.supplier?.name ?? ""}`}
                detailsDescription="Detalle de la solicitud y URL del proveedor"
                summary={
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={supplyRequestTone(r.status)}
                        label={supplyRequestLabel(r.status)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyUrl}
                      className="w-full"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar URL del proveedor
                    </Button>
                  </div>
                }
                details={<SupplyRequestDetails request={r} />}
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow" | "red";
}) {
  const color =
    tone === "green"
      ? "text-status-green"
      : tone === "yellow"
        ? "text-status-yellow"
        : tone === "red"
          ? "text-status-red"
          : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
