import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useGlobalConfigs, useGrossRevenueCurrentMonth } from "@/features/production/configApi";

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function FiscalSimulatorCard() {
  const { data: configs } = useGlobalConfigs();
  const { data: gross = 0, isLoading } = useGrossRevenueCurrentMonth();

  const ivaPct = Number(configs?.estimated_iva_percent ?? 0);
  const retPct = Number(configs?.estimated_retention_percent ?? 0);
  const iva = gross * (ivaPct / 100);
  const ret = gross * (retPct / 100);

  return (
    <Card className="max-w-2xl border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Simulador Fiscal · Mes actual</CardTitle>
        <p className="text-xs text-muted-foreground">
          Estos valores son proyecciones informativas para futura formalización.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Ingresos brutos</p>
              <p className="text-xl font-semibold tabular-nums">{currency(gross)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">IVA estimado ({ivaPct}%)</p>
              <p className="text-xl font-semibold tabular-nums">{currency(iva)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Retención ({retPct}%)</p>
              <p className="text-xl font-semibold tabular-nums">{currency(ret)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
