import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Boxes, Copy, Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/integrations/api/client";
import { toast } from "sonner";

interface PortalItem {
  id: string;
  raw_material_id: string;
  quantity_requested: number;
  quantity_confirmed: number;
  is_available: boolean;
  raw_material: {
    id: string;
    name: string;
    sku: string | null;
    unit_of_measure: string;
  } | null;
}

interface PortalRequest {
  id: string;
  status: "pending" | "partial" | "confirmed" | "delivered";
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_id: string;
  supplier: { id: string; name: string; contact_phone: string } | null;
  items: PortalItem[];
}

interface DraftItem {
  id: string;
  qty: string;
  available: boolean;
  checked: boolean; // control local del proveedor (su propio checklist)
}

export default function SupplierPortal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<PortalRequest | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{ request: PortalRequest }>("/supplier-portal", { token });
        if (cancelled) return;
        const req = data?.request;
        if (!req) throw new Error("Solicitud no encontrada");
        setRequest(req);
        setNotes(req.notes ?? "");
        const map: Record<string, DraftItem> = {};
        req.items.forEach((it) => {
          map[it.id] = {
            id: it.id,
            qty: String(it.quantity_confirmed || it.quantity_requested),
            available: it.is_available,
            checked: it.is_available && Number(it.quantity_confirmed) > 0,
          };
        });
        setDrafts(map);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const summary = useMemo(() => {
    if (!request) return "";
    const lines = request.items.map((it) => {
      const d = drafts[it.id];
      const unit = it.raw_material?.unit_of_measure ?? "";
      const name = it.raw_material?.name ?? "—";
      if (!d?.available) return `❌ ${name} — No disponible`;
      const qty = Math.max(0, Number(d.qty) || 0);
      return `✅ ${name}: ${qty} ${unit}`;
    });
    return [
      `Hola, soy ${request.supplier?.name ?? "el proveedor"}.`,
      `Resumen de la solicitud:`,
      ...lines,
      notes.trim() ? `\nNotas: ${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [request, drafts, notes]);

  const handleSave = async () => {
    if (!token || !request) return;
    setSaving(true);
    try {
      const items = Object.values(drafts).map((d) => ({
        id: d.id,
        quantity_confirmed: d.available ? Math.max(0, Number(d.qty) || 0) : 0,
        is_available: d.available,
      }));
      const data = await api.post<{ ok: true; status?: PortalRequest["status"] }>(
        "/supplier-portal",
        { token, items, notes },
      );
      toast.success("Confirmación enviada", {
        description: "Beast Club ya recibió tu respuesta. ¡Gracias!",
      });
      const newStatus = data?.status;
      if (newStatus) {
        setRequest((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }
    } catch (err) {
      toast.error("No se pudo enviar", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Resumen copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const sendWhatsApp = () => {
    const phone = request?.supplier?.contact_phone?.replace(/[^\d]/g, "");
    const url = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Beast Club · Portal Proveedor</p>
            <h1 className="truncate text-base font-semibold">
              {request?.supplier?.name ?? "Solicitud de insumos"}
            </h1>
          </div>
          {request && (
            <StatusBadge
              tone={
                request.status === "confirmed"
                  ? "green"
                  : request.status === "partial" || request.status === "pending"
                    ? "yellow"
                    : "neutral"
              }
              label={
                request.status === "confirmed"
                  ? "Confirmado"
                  : request.status === "partial"
                    ? "Parcial"
                    : request.status === "delivered"
                      ? "Entregado"
                      : "Pendiente"
              }
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-32">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>No pudimos cargar tu solicitud</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && request && (
          <>
            <Alert>
              <AlertTitle>Confirma tu disponibilidad</AlertTitle>
              <AlertDescription>
                Marca cada insumo, ajusta la cantidad que tienes y envía. Puedes usar el check
                de la izquierda como tu propio control.
              </AlertDescription>
            </Alert>

            <ul className="space-y-3">
              {request.items.map((it) => {
                const d = drafts[it.id];
                if (!d) return null;
                return (
                  <li
                    key={it.id}
                    className="rounded-xl border bg-background p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [it.id]: { ...d, checked: !d.checked },
                          }))
                        }
                        aria-pressed={d.checked}
                        aria-label="Marcar como revisado"
                        className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition ${
                          d.checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background"
                        }`}
                      >
                        {d.checked && (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="5 12 10 17 19 8" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">
                          {it.raw_material?.name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Solicitado: {it.quantity_requested} {it.raw_material?.unit_of_measure}
                          {it.raw_material?.sku ? ` · ${it.raw_material.sku}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`avail-${it.id}`}
                          checked={d.available}
                          onCheckedChange={(v) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [it.id]: { ...d, available: v },
                            }))
                          }
                        />
                        <Label htmlFor={`avail-${it.id}`} className="text-sm">
                          {d.available ? "Disponible" : "No disponible"}
                        </Label>
                      </div>
                    </div>

                    {d.available && (
                      <div className="mt-3 space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Cantidad que tienes ({it.raw_material?.unit_of_measure})
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={d.qty}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [it.id]: { ...d, qty: e.target.value },
                            }))
                          }
                          className="h-12 text-base"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tiempos de entrega, observaciones..."
                rows={3}
              />
            </div>

            <div className="rounded-xl border bg-background p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Resumen para WhatsApp</p>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
{summary}
                </pre>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={copySummary} className="h-11">
                  <Copy className="h-4 w-4 mr-1" /> Copiar resumen
                </Button>
                <Button type="button" variant="outline" onClick={sendWhatsApp} className="h-11">
                  <MessageCircle className="h-4 w-4 mr-1" /> Enviar por WhatsApp
                </Button>
              </div>
            </div>
          </>
        )}
      </main>

      {!loading && !error && request && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Button
              type="button"
              size="lg"
              onClick={handleSave}
              disabled={saving}
              className="h-12 w-full text-base"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              Enviar confirmación a Beast Club
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
