import { useEffect, useState } from "react";
import { Loader2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useGlobalConfigs, useUpdateGlobalConfig } from "@/features/production/configApi";
import { FiscalSimulatorCard } from "./FiscalSimulatorCard";

export function TaxesPanel() {
  const { data: configs, isLoading } = useGlobalConfigs();
  const update = useUpdateGlobalConfig();

  const [iva, setIva] = useState(0);
  const [ret, setRet] = useState(0);

  useEffect(() => {
    if (configs) {
      setIva(Number(configs.estimated_iva_percent ?? 0));
      setRet(Number(configs.estimated_retention_percent ?? 0));
    }
  }, [configs]);

  const save = async () => {
    try {
      await Promise.all([
        update.mutateAsync({ id: "estimated_iva_percent", value: iva }),
        update.mutateAsync({ id: "estimated_retention_percent", value: ret }),
      ]);
      toast({ title: "Proyección fiscal guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FiscalSimulatorCard />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Proyección de Impuestos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ajusta los porcentajes utilizados en el simulador fiscal mensual.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="iva">IVA estimado</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Porcentaje aplicado sobre los ingresos brutos del mes para proyectar el IVA a pagar.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative">
                <Input
                  id="iva"
                  type="number"
                  min="0"
                  step="0.1"
                  value={iva}
                  onChange={(e) => setIva(Number(e.target.value))}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="ret">Retención estimada</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Porcentaje de retención en la fuente esperado sobre los ingresos brutos del mes.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative">
                <Input
                  id="ret"
                  type="number"
                  min="0"
                  step="0.1"
                  value={ret}
                  onChange={(e) => setRet(Number(e.target.value))}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>
          <Button onClick={save} disabled={update.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {update.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Estos valores son proyecciones informativas para futura formalización.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
