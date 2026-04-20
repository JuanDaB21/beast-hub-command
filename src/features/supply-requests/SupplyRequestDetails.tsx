import { useState } from "react";
import { Copy, ExternalLink, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import {
  useDeleteSupplyRequest,
  useUpdateSupplyRequestStatus,
  type SupplyRequest,
} from "./api";
import { supplyRequestLabel, supplyRequestTone } from "./status";
import { toast } from "sonner";

interface Props {
  request: SupplyRequest;
  onClose?: () => void;
}

function buildPortalUrl(token: string) {
  if (typeof window === "undefined") return `/supplier/${token}`;
  return `${window.location.origin}/supplier/${token}`;
}

export function SupplyRequestDetails({ request, onClose }: Props) {
  const updateStatus = useUpdateSupplyRequestStatus();
  const remove = useDeleteSupplyRequest();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const portalUrl = buildPortalUrl(request.secure_token);

  const totalRequested = request.items.reduce((s, it) => s + Number(it.quantity_requested), 0);
  const totalConfirmed = request.items.reduce(
    (s, it) => s + (it.is_available ? Number(it.quantity_confirmed) : 0),
    0,
  );

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success("URL copiada", { description: "Pégala en WhatsApp para el proveedor." });
    } catch {
      toast.error("No se pudo copiar la URL");
    }
  };

  const waMessage =
    `Hola ${request.supplier?.name ?? ""}, te comparto la solicitud de insumos. ` +
    `Por favor confírmame disponibilidad en este enlace:\n${portalUrl}`;

  const markDelivered = async () => {
    try {
      await updateStatus.mutateAsync({ id: request.id, status: "delivered" });
      toast.success("Solicitud marcada como entregada");
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(request.id);
      toast.success("Solicitud eliminada");
      setDeleteOpen(false);
      onClose?.();
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Proveedor</p>
          <p className="text-lg font-semibold truncate">{request.supplier?.name ?? "—"}</p>
        </div>
        <StatusBadge tone={supplyRequestTone(request.status)} label={supplyRequestLabel(request.status)} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Items</p>
          <p className="tabular-nums">{request.items.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Solicitado / Confirmado</p>
          <p className="tabular-nums">
            {totalRequested} / {totalConfirmed}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Creada</p>
          <p>{new Date(request.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Actualizada</p>
          <p>{new Date(request.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-2 bg-muted/30">
        <p className="text-xs text-muted-foreground">URL del portal del proveedor</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 truncate text-xs bg-background border rounded px-2 py-2 font-mono">
            {portalUrl}
          </code>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir
              </a>
            </Button>
          </div>
        </div>
        {request.supplier?.contact_phone && (
          <WhatsAppContactButton
            phone={request.supplier.contact_phone}
            message={waMessage}
            className="w-full sm:w-auto"
          />
        )}
      </div>

      {request.notes && (
        <div className="rounded-md bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1">Notas</p>
          <p>{request.notes}</p>
        </div>
      )}

      <div className="rounded-md border">
        <div className="p-3 border-b bg-muted/30 text-sm font-medium">Insumos solicitados</div>
        <ul className="divide-y">
          {request.items.map((it) => {
            const reqQ = Number(it.quantity_requested);
            const confQ = Number(it.quantity_confirmed);
            const fully = it.is_available && confQ >= reqQ && reqQ > 0;
            const partial = it.is_available && confQ > 0 && confQ < reqQ;
            const unavailable = !it.is_available;
            return (
              <li key={it.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{it.raw_material?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.raw_material?.sku ?? ""} · {it.raw_material?.unit_of_measure ?? ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {confQ} / {reqQ}
                  </span>
                  {unavailable && <StatusBadge tone="red" label="No disp." />}
                  {fully && <StatusBadge tone="green" label="OK" />}
                  {partial && <StatusBadge tone="yellow" label="Parcial" />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {request.status !== "delivered" && (
          <Button onClick={markDelivered} disabled={updateStatus.isPending}>
            {updateStatus.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Marcar entregado
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Eliminar solicitud
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El enlace dejará de funcionar para el proveedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
