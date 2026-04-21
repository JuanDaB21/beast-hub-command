import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useGlobalConfigs, useUpdateGlobalConfig } from "@/features/production/configApi";

interface FieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  suffix?: string;
}

function Field({ id, label, hint, value, onChange, step = "0.1", suffix = "%" }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

export function CommissionsPanel() {
  const { data: configs, isLoading } = useGlobalConfigs();
  const update = useUpdateGlobalConfig();

  const [shopify, setShopify] = useState(0);
  const [gatewayPct, setGatewayPct] = useState(0);
  const [gatewayFixed, setGatewayFixed] = useState(0);
  const [codPct, setCodPct] = useState(0);

  useEffect(() => {
    if (configs) {
      setShopify(Number(configs.shopify_fee_percent ?? 0));
      setGatewayPct(Number(configs.gateway_fee_percent ?? 0));
      setGatewayFixed(Number(configs.gateway_fee_fixed ?? 0));
      setCodPct(Number(configs.cod_transport_fee_percent ?? 0));
    }
  }, [configs]);

  const save = async () => {
    try {
      await Promise.all([
        update.mutateAsync({ id: "shopify_fee_percent", value: shopify }),
        update.mutateAsync({ id: "gateway_fee_percent", value: gatewayPct }),
        update.mutateAsync({ id: "gateway_fee_fixed", value: gatewayFixed }),
        update.mutateAsync({ id: "cod_transport_fee_percent", value: codPct }),
      ]);
      toast({ title: "Comisiones guardadas" });
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
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Comisiones y Pasarelas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Estos porcentajes alimentan los cálculos automáticos de neto estimado y total a cobrar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="shopify_fee_percent"
            label="Comisión Shopify"
            value={shopify}
            onChange={setShopify}
            hint="Porcentaje que Shopify descuenta sobre el total de cada orden proveniente de la tienda online."
          />
          <Field
            id="gateway_fee_percent"
            label="Comisión Pasarela (%)"
            value={gatewayPct}
            onChange={setGatewayPct}
            hint="Porcentaje que la pasarela de pago cobra sobre el total de la transacción."
          />
          <Field
            id="gateway_fee_fixed"
            label="Comisión Pasarela fija"
            value={gatewayFixed}
            onChange={setGatewayFixed}
            step="1"
            suffix="$"
            hint="Tarifa fija en pesos que la pasarela suma a cada transacción."
          />
          <Field
            id="cod_transport_fee_percent"
            label="Comisión transportadora COD"
            value={codPct}
            onChange={setCodPct}
            hint="Este % se suma al cobro final del cliente en envíos contra entrega. La transportadora lo cobra al cliente."
          />
        </div>
        <Button onClick={save} disabled={update.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </CardContent>
    </Card>
  );
}
