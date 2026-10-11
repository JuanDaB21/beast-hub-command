import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Mail, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  useEmailIngestStatus,
  useRunEmailIngest,
  useUpdateEmailIngestConfig,
  type EmailIngestLogRow,
} from "@/features/shopify/api";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_LABEL: Record<EmailIngestLogRow["status"], { text: string; cls: string }> = {
  imported: { text: "Importado", cls: "text-green-700" },
  skipped: { text: "Ya existía", cls: "text-muted-foreground" },
  error: { text: "Error", cls: "text-red-700" },
  no_payload: { text: "Sin bloque", cls: "text-amber-700" },
};

/**
 * Importación automática de pedidos: el servidor lee de Gmail las
 * notificaciones "Nuevo pedido" de Shopify (con el bloque de
 * docs/shopify/staff-order-notification.liquid) y las importa solas.
 */
export function EmailIngestCard() {
  const status = useEmailIngestStatus();
  const update = useUpdateEmailIngestConfig();
  const run = useRunEmailIngest();
  const data = status.data;
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (data) setQuery(data.query);
  }, [data?.query]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch: { enabled?: boolean; query?: string }) => {
    try {
      await update.mutateAsync(patch);
      toast({ title: "Importación automática actualizada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleRun = async () => {
    try {
      const r = await run.mutateAsync();
      if (!r.ran) {
        toast({ title: "No se ejecutó", description: r.reason, variant: "destructive" });
        return;
      }
      const parts = [
        `${r.imported} importado${r.imported === 1 ? "" : "s"}`,
        `${r.skipped} ya existía${r.skipped === 1 ? "" : "n"}`,
      ];
      if (r.no_payload) parts.push(`${r.no_payload} correo(s) sin bloque`);
      if (r.unmatched_items) parts.push(`${r.unmatched_items} línea(s) sin producto`);
      toast({
        title: r.errors.length ? `Revisión con ${r.errors.length} error(es)` : "Gmail revisado",
        description: parts.join(" · "),
        variant: r.errors.length ? "destructive" : undefined,
      });
    } catch (e) {
      toast({ title: "Error al revisar Gmail", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Importación automática desde Gmail
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada pedido nuevo de Shopify envía la notificación "Nuevo pedido" al Gmail; el servidor la
          lee cada {data?.poll_minutes ?? 5} min y crea el pedido con cliente, dirección y teléfono.
          Reemplaza la exportación diaria del CSV (que queda como respaldo).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}

        {data && !data.gmail_configured && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Falta configurar Gmail en el servidor (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
            GMAIL_REFRESH_TOKEN en Railway).
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center gap-3">
              <Switch
                id="email-ingest-enabled"
                checked={data.enabled}
                onCheckedChange={(v) => save({ enabled: v })}
                disabled={!data.gmail_configured || update.isPending}
              />
              <Label htmlFor="email-ingest-enabled" className="cursor-pointer">
                Importar pedidos automáticamente
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-ingest-query">Búsqueda en Gmail</Label>
              <div className="flex gap-2">
                <Input
                  id="email-ingest-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => save({ query })}
                  disabled={update.isPending || !query.trim() || query === data.query}
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Misma sintaxis del buscador de Gmail. Las notificaciones de pedido llegan desde{" "}
                <span className="font-mono">t.shopifyemail.com</span> con asunto "Pedido #…".
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Última revisión: {formatDate(data.last_run)}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRun}
                disabled={run.isPending || !data.gmail_configured}
              >
                {run.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {run.isPending ? "Revisando…" : "Revisar ahora"}
              </Button>
            </div>

            {data.last_error && (
              <p className="text-xs text-red-700 break-words">Último error: {data.last_error}</p>
            )}

            {data.missing.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  {data.missing.length} pedido{data.missing.length === 1 ? "" : "s"} de Shopify
                  (últimas 48 h) sin importar
                </div>
                <p className="text-xs text-amber-900">
                  {data.missing.map((m) => m.name).join(", ")} — revisa que la notificación llegó
                  al Gmail o súbelos con el CSV.
                </p>
              </div>
            )}
            {data.missing_error && (
              <p className="text-xs text-muted-foreground">
                No se pudo verificar faltantes en Shopify: {data.missing_error}
              </p>
            )}

            {data.log.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Últimos correos procesados</p>
                <ul className="text-xs max-h-48 overflow-y-auto divide-y rounded-md border">
                  {data.log.map((row) => (
                    <li key={row.gmail_message_id} className="flex gap-2 px-2 py-1">
                      <span className="w-28 shrink-0 text-muted-foreground">
                        {formatDate(row.received_at ?? row.processed_at)}
                      </span>
                      <span className="w-20 shrink-0 font-mono truncate">{row.order_name ?? "—"}</span>
                      <span className={`w-20 shrink-0 ${STATUS_LABEL[row.status].cls}`}>
                        {STATUS_LABEL[row.status].text}
                      </span>
                      {row.error && <span className="truncate text-red-700">{row.error}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
