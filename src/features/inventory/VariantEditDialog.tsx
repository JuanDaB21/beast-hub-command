import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useUpdateProduct, type Product } from "./api";
import { usePrintDesigns } from "@/features/print-designs/api";
import { toast } from "@/hooks/use-toast";

interface Props {
  variant: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VariantEditDialog({ variant, open, onOpenChange }: Props) {
  const update = useUpdateProduct();
  const { data: printDesigns = [] } = usePrintDesigns({ active: true });
  const [stock, setStock] = useState(0);
  const [safety, setSafety] = useState(0);
  const [aging, setAging] = useState(30);
  const [price, setPrice] = useState(0);
  const [designId, setDesignId] = useState<string | null>(null);
  const [printHeight, setPrintHeight] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!variant) return;
    setStock(Number(variant.stock));
    setSafety(Number(variant.safety_stock));
    setAging(Number(variant.aging_days));
    setPrice(Number(variant.price));
    setDesignId(variant.print_design_id ?? null);
    setPrintHeight(Number(variant.print_height_cm ?? 0));
    setActive(variant.active);
  }, [variant]);

  const designOptions = useMemo(
    () => printDesigns.map((d) => ({ value: d.id, label: d.name })),
    [printDesigns],
  );
  const selectedDesign = useMemo(
    () => printDesigns.find((d) => d.id === designId) ?? null,
    [printDesigns, designId],
  );

  const handleSave = async () => {
    if (!variant) return;
    try {
      await update.mutateAsync({
        id: variant.id,
        stock,
        safety_stock: safety,
        aging_days: aging,
        price,
        print_design_id: selectedDesign?.id ?? null,
        print_design: selectedDesign?.name ?? null,
        print_color: selectedDesign?.hex_code ?? null,
        print_height_cm: printHeight,
        active,
      });
      toast({ title: "Variante actualizada" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Error al guardar",
        description: err instanceof Error ? err.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar variante</DialogTitle>
          <DialogDescription>{variant?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumF label="Stock" value={stock} onChange={setStock} />
            <NumF label="Stock seguridad" value={safety} onChange={setSafety} />
            <NumF label="Aging (días)" value={aging} onChange={setAging} />
            <NumF label="Precio" value={price} step="100" onChange={setPrice} />
          </div>
          <div className="space-y-1.5">
            <Label>Estampado</Label>
            <StandardCombobox
              options={designOptions}
              value={designId}
              onChange={setDesignId}
              placeholder="Sin estampado"
              searchPlaceholder="Buscar estampado..."
              emptyText="No hay estampados activos"
            />
            {selectedDesign && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-border"
                  style={{ backgroundColor: selectedDesign.hex_code }}
                />
                <span>{selectedDesign.hex_code}</span>
              </div>
            )}
          </div>
          <NumF label="Altura estampado (cm)" value={printHeight} step="0.5" onChange={setPrintHeight} />
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="v-active">Variante activa</Label>
            <Switch id="v-active" checked={active} onCheckedChange={setActive} />
          </div>
          <Button className="w-full" onClick={handleSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumF({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
