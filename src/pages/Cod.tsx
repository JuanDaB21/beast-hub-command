import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCodOrders,
  useConfirmCodOrder,
  useConfirmCodReceipt,
  type CodOrder,
} from "@/features/cod/api";
import { CheckCircle2, ClipboardCheck, Truck } from "lucide-react";
import { toast } from "sonner";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

type TabKey = "to_confirm" | "to_collect" | "collected" | "all";

function needsOrderConfirmation(o: CodOrder) {
  return o.source === "shopify" && !o.order_confirmed && !o.cod_confirmed;
}
function readyToCollect(o: CodOrder) {
  return !o.cod_confirmed && (o.order_confirmed || o.source === "manual");
}

export default function Cod() {
  const { data: orders, isLoading } = useCodOrders();
  const confirmOrder = useConfirmCodOrder();
  const confirmReceipt = useConfirmCodReceipt();

  const [tab, setTab] = useState<TabKey>("to_confirm");
  const [search, setSearch] = useState("");
  const [carrier, setCarrier] = useState<string>("all");

  const carriers = useMemo(() => {
    const set = new Set<string>();
    (orders ?? []).forEach((o) => o.carrier && set.add(o.carrier));
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders ?? [];
    if (tab === "to_confirm") list = list.filter(needsOrderConfirmation);
    if (tab === "to_collect") list = list.filter(readyToCollect);
    if (tab === "collected") list = list.filter((o) => o.cod_confirmed);
    if (carrier !== "all") list = list.filter((o) => (o.carrier ?? "") === carrier);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          (o.tracking_number ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, tab, search, carrier]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const toConfirm = list.filter(needsOrderConfirmation);
    const toCollect = list.filter(readyToCollect);
    const collected = list.filter((o) => o.cod_confirmed);
    return {
      total: list.length,
      toConfirmCount: toConfirm.length,
      toConfirmAmount: toConfirm.reduce((s, o) => s + Number(o.total ?? 0), 0),
      toCollectCount: toCollect.length,
      toCollectAmount: toCollect.reduce((s, o) => s + Number(o.total ?? 0), 0),
      collectedAmount: collected.reduce((s, o) => s + Number(o.total ?? 0), 0),
    };
  }, [orders]);

  const handleConfirmOrder = (id: string, num: string) => {
    confirmOrder.mutate(id, {
      onSuccess: () => toast.success(`Pedido confirmado: ${num}`),
      onError: (e: any) => toast.error(e?.message ?? "Error al confirmar pedido"),
    });
  };

  const handleConfirmReceipt = (id: string, num: string) => {
    confirmReceipt.mutate(id, {
      onSuccess: () => toast.success(`Recaudo confirmado: ${num}`),
      onError: (e: any) => toast.error(e?.message ?? "Error al confirmar recaudo"),
    });
  };

  return (
    <AppShell
      title="Gestión COD · Recaudo"
      description="Confirma pedidos y concilia el dinero contra entrega."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Pendientes de confirmación"
          value={String(stats.toConfirmCount)}
          tone="red"
          hint={currency(stats.toConfirmAmount)}
        />
        <KPI
          label="Pendientes de recaudo"
          value={String(stats.toCollectCount)}
          tone="yellow"
          hint={currency(stats.toCollectAmount)}
        />
        <KPI
          label="Dinero recaudado"
          value={currency(stats.collectedAmount)}
          tone="green"
        />
        <KPI label="Total COD" value={String(stats.total)} />
      </div>

      <Card className="mt-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="to_confirm">Por confirmar</TabsTrigger>
              <TabsTrigger value="to_collect">Por recaudar</TabsTrigger>
              <TabsTrigger value="collected">Recaudados</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Transportadora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las transportadoras</SelectItem>
                {carriers.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar # pedido, cliente, guía…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No hay pedidos COD con esos filtros.
          </Card>
        ) : (
          filtered.map((o) => {
            const stage: "to_confirm" | "to_collect" | "collected" = o.cod_confirmed
              ? "collected"
              : needsOrderConfirmation(o)
              ? "to_confirm"
              : "to_collect";

            return (
              <Card key={o.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{o.order_number}</span>
                      <Badge variant="outline">{o.status}</Badge>
                      <Badge variant="secondary" className="capitalize">
                        {o.source}
                      </Badge>
                      {stage === "to_confirm" && (
                        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400">
                          Pendiente confirmación
                        </Badge>
                      )}
                      {stage === "to_collect" && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-500">
                          Pedido confirmado
                        </Badge>
                      )}
                      {stage === "collected" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          Recaudo confirmado
                        </Badge>
                      )}
                      {o.carrier && (
                        <Badge variant="secondary" className="gap-1">
                          <Truck className="h-3 w-3" />
                          {o.carrier}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm">
                      {o.customer_name} · {o.customer_phone}
                    </p>
                    {o.tracking_number && (
                      <p className="text-xs text-muted-foreground">Guía: {o.tracking_number}</p>
                    )}
                    {o.order_confirmed_at && (
                      <p className="text-xs text-muted-foreground">
                        Pedido confirmado el {new Date(o.order_confirmed_at).toLocaleString()}
                      </p>
                    )}
                    {o.cod_received_at && (
                      <p className="text-xs text-muted-foreground">
                        Recaudado el {new Date(o.cod_received_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-semibold">{currency(Number(o.total))}</p>
                    </div>
                    {stage === "to_confirm" && (
                      <Button
                        onClick={() => handleConfirmOrder(o.id, o.order_number)}
                        disabled={confirmOrder.isPending}
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Confirmar pedido
                      </Button>
                    )}
                    {stage === "to_collect" && (
                      <Button
                        onClick={() => handleConfirmReceipt(o.id, o.order_number)}
                        disabled={confirmReceipt.isPending}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmar recaudo
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function KPI({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "green" | "yellow" | "red";
  hint?: string;
}) {
  const toneCls =
    tone === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "yellow"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "red"
      ? "text-red-600 dark:text-red-400"
      : "";
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
