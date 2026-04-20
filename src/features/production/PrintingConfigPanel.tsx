import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useGlobalConfigs, useUpdateGlobalConfig } from "./configApi";

/**
 * Panel para editar costos globales de estampado y planchado.
 * Estos valores se usan para calcular automáticamente el costo de cada producto.
 */
export function PrintingConfigPanel() {
  const { data: configs, isLoading } = useGlobalConfigs();
  const update = useUpdateGlobalConfig();

  const [printingCost, setPrintingCost] = useState<number>(0);
  const [ironingCost, setIroningCost] = useState<number>(0);

  useEffect(() => {
    if (configs) {
      setPrintingCost(Number(configs.printing_cost_per_meter ?? 0));
      setIroningCost(Number(configs.ironing_cost ?? 0));
    }
  }, [configs]);

  const handleSave = async () => {
    try {
      await Promise.all([
        update.mutateAsync({ id: "printing_cost_per_meter", value: printingCost }),
        update.mutateAsync({ id: "ironing_cost", value: ironingCost }),
      ]);
      toast({ title: "Configuración guardada" });
    } catch (err) {
      toast({
        title: "Error al guardar",
        description: err instanceof Error ? err.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración...
      </div>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Costos globales de estampado</CardTitle>
        <p className="text-xs text-muted-foreground">
          Estos valores se aplican automáticamente al calcular el costo de cada producto final.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="printing-cost">Costo de impresión por metro lineal (COP)</Label>
          <Input
            id="printing-cost"
            type="number"
            min="0"
            step="100"
            value={printingCost}
            onChange={(e) => setPrintingCost(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Se prorratea según la altura del estampado (cm / 100 × este valor).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ironing-cost">Costo de planchado por prenda (COP)</Label>
          <Input
            id="ironing-cost"
            type="number"
            min="0"
            step="100"
            value={ironingCost}
            onChange={(e) => setIroningCost(Number(e.target.value))}
          />
        </div>
        <Button onClick={handleSave} disabled={update.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {update.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </CardContent>
    </Card>
  );
}
