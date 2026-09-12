import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageCheck } from "lucide-react";
import { codStage, type CodStage, type ShipmentOrder } from "./api";
import { KpiTile } from "./KpiTile";
import { ShipmentCard } from "./FulfillmentBoard";

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

interface Props {
  /** Feed completo de Logística; el panel se queda solo con los COD. */
  orders: ShipmentOrder[];
  onShip: (order: ShipmentOrder) => void;
}

const STAGE_TABS: { value: CodStage | "all"; label: string }[] = [
  { value: "to_confirm", label: "Por confirmar" },
  { value: "to_collect", label: "Por recaudar" },
  { value: "collected", label: "Recaudado" },
  { value: "all", label: "Todos" },
];

/**
 * Ciclo de recaudo contra-entrega, absorbido de la antigua página COD.
 *
 * El recaudo ya no se marca a mano: entregar cierra el hito, porque si la
 * transportadora entregó, cobró. Por eso "Recaudado" significa que el dinero
 * está en manos de la transportadora, no que haya entrado a la empresa — eso se
 * verifica en Finanzas, cruzando este total contra los ingresos 'Pago COD'.
 */
export function CodCollectionPanel({ orders, onShip }: Props) {
  const [stage, setStage] = useState<CodStage | "all">("to_confirm");

  const codOrders = useMemo(() => orders.filter((o) => o.is_cod), [orders]);

  const groups = useMemo(() => {
    const acc: Record<CodStage, ShipmentOrder[]> = {
      to_confirm: [],
      to_collect: [],
      collected: [],
    };
    for (const o of codOrders) acc[codStage(o)].push(o);
    return acc;
  }, [codOrders]);

  const sum = (list: ShipmentOrder[]) => list.reduce((n, o) => n + Number(o.total), 0);

  const visible = stage === "all" ? codOrders : groups[stage];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Por confirmar"
          value={String(groups.to_confirm.length)}
          hint={currency(sum(groups.to_confirm))}
          tone={groups.to_confirm.length > 0 ? "red" : undefined}
        />
        <KpiTile
          label="Por recaudar"
          value={String(groups.to_collect.length)}
          hint={currency(sum(groups.to_collect))}
          tone={groups.to_collect.length > 0 ? "yellow" : undefined}
        />
        <KpiTile
          label="En manos de la transportadora"
          value={currency(sum(groups.collected))}
          hint={`${groups.collected.length} entregados · contrastar en Finanzas`}
          tone="green"
        />
        <KpiTile label="Total COD" value={String(codOrders.length)} />
      </div>

      <Tabs value={stage} onValueChange={(v) => setStage(v as CodStage | "all")}>
        <TabsList>
          {STAGE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label} ({t.value === "all" ? codOrders.length : groups[t.value].length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <PackageCheck className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay pedidos contra-entrega en esta etapa.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => (
            <ShipmentCard key={o.id} order={o} onShip={() => onShip(o)} />
          ))}
        </div>
      )}
    </div>
  );
}
