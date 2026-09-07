import { useEffect, useState } from "react";
import { Copy, ExternalLink, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  useCompleteSupplyRequest,
  useDeleteSupplyRequest,
  useReceiveSupplyItem,
  type SupplyRequest,
  type SupplyRequestItem,
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

/**
 * Una línea de recepción: el operario marca el check (recibe todo lo confirmado)
 * o escribe la cantidad exacta que llegó. Cada cambio carga el delta al
 * inventario en el servidor, así que una recepción parcial queda registrada.
 */
function ReceptionRow({ item }: { item: SupplyRequestItem }) {
  const receive = useReceiveSupplyItem();
  const reqQ = Number(item.quantity_requested);
  const confQ = Number(item.quantity_confirmed);
  const recQ = Number(item.quantity_received);
  const [draft, setDraft] = useState(String(recQ));

  // El servidor es la fuente de verdad: si otro usuario recibe, se re-sincroniza.
  useEffect(() => setDraft(String(recQ)), [recQ]);

  const submit = async (value: number) => {
    if (value === recQ) return;
    try {
      await receive.mutateAsync({ itemId: item.id, quantity_received: value });
    } catch (err) {
      setDraft(String(recQ));
      toast.error("No se pudo registrar la recepción", {
        description: (err as Error).message,
      });
    }
  };

  const toggle = (checked: boolean) => submit(checked ? confQ : 0);

  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(recQ));
      return;
    }
    submit(parsed);
  };

  const complete = recQ >= confQ && confQ > 0;

  return (
    <li className="flex items-center justify-between gap-3 p-3 text-sm">
      <div className="flex items-start gap-3 min-w-0">
        <Checkbox
          checked={complete}
          disabled={!item.is_available || confQ <= 0 || receive.isPending}
          onCheckedChange={(v) => toggle(v === true)}
          className="mt-1"
          aria-label={`Recibir ${item.raw_material?.name ?? "insumo"}`}
        />
        <div className="min-w-0">
          <p className="font-medium truncate">{item.raw_material?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            Pedido {reqQ} · confirmado {confQ} {item.raw_material?.unit_of_measure ?? ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!item.is_available ? (
          <StatusBadge tone="red" label="No disp." />
        ) : (
          <>
            <Input
              type="number"
              min={0}
              step="any"
              value={draft}
              disabled={receive.isPending}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="h-8 w-20 text-right tabular-nums"
              aria-label="Cantidad recibida"
            />
            {receive.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </>
        )}
      </div>
    </li>
  );
}

export function SupplyRequestDetails({ request, onClose }: Props) {
  const complete = useCompleteSupplyRequest();
  const remove = useDeleteSupplyRequest();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const portalUrl = buildPortalUrl(request.secure_token);

  const totalRequested = request.items.reduce((s, it) => s + Number(it.quantity_requested), 0);
  const totalConfirmed = request.items.reduce(
    (s, it) => s + (it.is_available ? Number(it.quantity_confirmed) : 0),
    0,
  );
  const totalReceived = request.items.reduce((s, it) => s + Number(it.quantity_received), 0);
  const pendingToReceive = Math.max(0, totalConfirmed - totalReceived);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success("URL copiada", { description: "Pégala en WhatsApp para el proveedor." });
    } catch {
      toast.error("No se pudo copiar la URL");
    }
  };

  const waMessage =
    `Hola ${request.supplier?.name ?? ""}, te comparto la solicitud de bases. ` +
    `Por favor confírmame disponibilidad en este enlace:\n${portalUrl}`;

  const markDelivered = async () => {
    try {
      await complete.mutateAsync(request.id);
      const summaryLines = request.items
        .filter(
          (it) => it.is_available && Number(it.quantity_confirmed) > Number(it.quantity_received),
        )
        .map(
          (it) =>
            `+${Number(it.quantity_confirmed) - Number(it.quantity_received)} ${it.raw_material?.name ?? ""}`,
        )
        .join(", ");
      toast.success("Inventario actualizado", {
        description: summaryLines
          ? `Se han sumado: ${summaryLines}`
          : "Solicitud marcada como entregada",
      });
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
          <p className="text-xs text-muted-foreground">Pedido / Confirmado / Recibido</p>
          <p className="tabular-nums">
            {totalRequested} / {totalConfirmed} / {totalReceived}
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
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Recepción</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {totalReceived} / {totalConfirmed} recibido
          </span>
        </div>
        {totalConfirmed > 0 && (
          <Progress value={(totalReceived / totalConfirmed) * 100} className="h-1 rounded-none" />
        )}
        <ul className="divide-y">
          {request.items.map((it) => (
            <ReceptionRow key={it.id} item={it} />
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {pendingToReceive > 0 && (
          <Button onClick={markDelivered} disabled={complete.isPending}>
            {complete.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Recibir todo lo pendiente ({pendingToReceive})
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
