import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { useReturns, type ReturnRow, type ReturnStatus } from "@/features/returns/api";
import { ReturnsBoard } from "@/features/returns/ReturnsBoard";
import { NewReturnForm } from "@/features/returns/NewReturnForm";
import { ResolveReturnDialog } from "@/features/returns/ResolveReturnDialog";

type Tab = "all" | ReturnStatus;

export default function Returns() {
  const { data: returns = [], isLoading } = useReturns();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [formOpen, setFormOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<ReturnRow | null>(null);

  const filtered = useMemo(() => {
    let out = returns;
    if (tab !== "all") out = out.filter((r) => r.resolution_status === tab);
    const v = filter.trim().toLowerCase();
    if (v) {
      out = out.filter(
        (r) =>
          (r.order?.order_number ?? "").toLowerCase().includes(v) ||
          (r.order?.customer_name ?? "").toLowerCase().includes(v) ||
          (r.product?.name ?? "").toLowerCase().includes(v) ||
          (r.product?.sku ?? "").toLowerCase().includes(v) ||
          r.reason_category.toLowerCase().includes(v),
      );
    }
    return out;
  }, [returns, filter, tab]);

  const stats = useMemo(() => {
    let pending = 0, restocked = 0, scrapped = 0;
    for (const r of returns) {
      if (r.resolution_status === "pending") pending++;
      else if (r.resolution_status === "restocked") restocked++;
      else if (r.resolution_status === "scrapped") scrapped++;
    }
    return { total: returns.length, pending, restocked, scrapped };
  }, [returns]);

  const headerActions = (
    <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Nueva devolución</span>
    </Button>
  );

  return (
    <AppShell
      title="Módulo 7 · Devoluciones (RMA)"
      description="Calidad y resolución: re-ingreso a stock o merma."
      actions={headerActions}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Totales" value={String(stats.total)} />
        <KPI label="Pendientes" value={String(stats.pending)} tone="yellow" />
        <KPI label="Re-ingresadas" value={String(stats.restocked)} tone="green" />
        <KPI label="Merma" value={String(stats.scrapped)} tone="red" />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="restocked">Re-ingresadas</TabsTrigger>
            <TabsTrigger value="scrapped">Merma</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por pedido, cliente, producto, motivo..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <ReturnsBoard returns={filtered} onResolve={(r) => setResolveTarget(r)} />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar nueva devolución</DialogTitle>
            <DialogDescription>
              Selecciona el pedido y el producto que el cliente está devolviendo.
            </DialogDescription>
          </DialogHeader>
          <NewReturnForm onSuccess={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      <ResolveReturnDialog
        ret={resolveTarget}
        open={!!resolveTarget}
        onOpenChange={(open) => !open && setResolveTarget(null)}
      />
    </AppShell>
  );
}

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "yellow" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "text-status-red"
      : tone === "yellow"
        ? "text-status-yellow"
        : tone === "green"
          ? "text-status-green"
          : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${toneClass}`}>
        {value}
      </div>
    </Card>
  );
}
