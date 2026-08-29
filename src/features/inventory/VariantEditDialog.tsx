import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Loader2, Plus, Trash2 } from "lucide-react";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useUpdateProduct, type Product } from "./api";
import { usePrintDesigns } from "@/features/print-designs/api";
import { DesignDialog } from "@/features/print-designs/DesignDialog";
import {
  useProductMaterials,
  useUpsertProductMaterial,
  useDeleteProductMaterial,
} from "@/features/production/api";
import { useRawMaterials } from "@/features/sourcing/api";
import { useGlobalConfigs } from "@/features/production/configApi";
import {
  useProductionProcesses,
  useProductProcessesBatch,
  useSetProductProcesses,
} from "@/features/production-processes/api";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

interface Props {
  variant: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDelete?: (variant: Product) => void;
}

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function VariantEditDialog({ variant, open, onOpenChange, onRequestDelete }: Props) {
  const update = useUpdateProduct();
  const upsertMaterial = useUpsertProductMaterial();
  const deleteMaterial = useDeleteProductMaterial();
  const setProductProcesses = useSetProductProcesses();
  const { data: printDesigns = [] } = usePrintDesigns({ active: true });
  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: allProcesses = [] } = useProductionProcesses({ active: true });
  const { data: configs } = useGlobalConfigs();
  const { data: bom = [] } = useProductMaterials(open ? variant?.id ?? null : null);
  const { data: assignedProcesses = [] } = useProductProcessesBatch(
    open && variant?.id ? [variant.id] : [],
  );

  const [stock, setStock] = useState(0);
  const [safety, setSafety] = useState(0);
  const [aging, setAging] = useState(30);
  const [price, setPrice] = useState(0);
  const [designId, setDesignId] = useState<string | null>(null);
  const [printHeight, setPrintHeight] = useState(0);
  const [baseMaterialId, setBaseMaterialId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [selectedProcessIds, setSelectedProcessIds] = useState<Set<string>>(new Set());

  const baseRow = useMemo(() => bom.find((r) => r.role === "base") ?? null, [bom]);
  const inkRow = useMemo(() => bom.find((r) => r.role === "ink") ?? null, [bom]);

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

  // Sincroniza la base seleccionada cuando llega el BOM.
  useEffect(() => {
    setBaseMaterialId(baseRow?.raw_material_id ?? null);
  }, [baseRow]);

  // Sincroniza los procesos asignados cuando llegan.
  useEffect(() => {
    setSelectedProcessIds(new Set(assignedProcesses.map((a) => a.process_id)));
  }, [assignedProcesses]);

  const designOptions = useMemo(
    () => printDesigns.map((d) => ({ value: d.id, label: d.name })),
    [printDesigns],
  );
  const selectedDesign = useMemo(
    () => printDesigns.find((d) => d.id === designId) ?? null,
    [printDesigns, designId],
  );

  const baseOptions = useMemo(
    () =>
      [...rawMaterials]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({
          value: m.id,
          label: [m.name, m.size?.label, m.color?.name, COP(Number(m.unit_price))]
            .filter(Boolean)
            .join(" · "),
        })),
    [rawMaterials],
  );
  const selectedBase = useMemo(
    () => rawMaterials.find((m) => m.id === baseMaterialId) ?? null,
    [rawMaterials, baseMaterialId],
  );

  // ── Costo estimado en vivo ──────────────────────────────────────
  const printingPerMeter = Number(configs?.printing_cost_per_meter ?? 0);
  const ironingCost = Number(configs?.ironing_cost ?? 0);
  const baseCost = selectedBase ? Number(selectedBase.unit_price) : 0;
  const inkGrams =
    selectedDesign?.ink_raw_material_id && printHeight > 0
      ? printHeight * (selectedDesign.ink_grams_per_cm ?? 0.5)
      : 0;
  const inkUnitPrice = selectedDesign?.ink_raw_material?.unit_price
    ? Number(selectedDesign.ink_raw_material.unit_price)
    : 0;
  const inkCost = inkGrams * inkUnitPrice;
  const printingCost = (printHeight / 100) * printingPerMeter;
  const processCost = allProcesses
    .filter((p) => selectedProcessIds.has(p.id))
    .reduce((acc, p) => acc + Number(p.cost), 0);
  const totalCost = baseCost + inkCost + printingCost + ironingCost + processCost;
  const margin = price - totalCost;
  const marginPct = price > 0 ? (margin / price) * 100 : 0;

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
        cost: Math.round(totalCost),
        active,
      });

      // Base (BOM role='base'): si cambió, reemplaza la fila anterior.
      if (baseMaterialId && baseMaterialId !== baseRow?.raw_material_id) {
        if (baseRow) await deleteMaterial.mutateAsync({ id: baseRow.id, product_id: variant.id });
        await upsertMaterial.mutateAsync({
          product_id: variant.id,
          raw_material_id: baseMaterialId,
          quantity_required: 1,
          role: "base",
        });
      }

      // Tinta (BOM role='ink'): recalcula según estampado + altura.
      const newInkId = selectedDesign?.ink_raw_material_id ?? null;
      if (newInkId && inkGrams > 0) {
        // Si cambió el material de tinta, elimina el anterior.
        if (inkRow && inkRow.raw_material_id !== newInkId) {
          await deleteMaterial.mutateAsync({ id: inkRow.id, product_id: variant.id });
        }
        await upsertMaterial.mutateAsync({
          product_id: variant.id,
          raw_material_id: newInkId,
          quantity_required: inkGrams,
          role: "ink",
        });
      } else if (inkRow) {
        // Sin estampado o sin altura → quita la fila de tinta.
        await deleteMaterial.mutateAsync({ id: inkRow.id, product_id: variant.id });
      }

      // Procesos adicionales asignados a la variante.
      await setProductProcesses.mutateAsync({
        productId: variant.id,
        processIds: Array.from(selectedProcessIds),
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

  const pending =
    update.isPending ||
    upsertMaterial.isPending ||
    deleteMaterial.isPending ||
    setProductProcesses.isPending;

  const toggleProcess = (id: string) =>
    setSelectedProcessIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <Label>Prenda base (materia prima)</Label>
            <StandardCombobox
              options={baseOptions}
              value={baseMaterialId}
              onChange={setBaseMaterialId}
              placeholder="Selecciona la base..."
              searchPlaceholder="Buscar por nombre, talla o color..."
              emptyText="No hay materias primas"
            />
            <p className="text-xs text-muted-foreground">
              Puedes elegir una base de otra talla (ej. producto talla M fabricado con base S).
              No cambia la talla nominal de la variante.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Estampado</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <StandardCombobox
                  options={designOptions}
                  value={designId}
                  onChange={setDesignId}
                  placeholder="Sin estampado"
                  searchPlaceholder="Buscar estampado..."
                  emptyText="No hay estampados activos"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDesignDialogOpen(true)}
                title="Nuevo estampado"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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

          {allProcesses.length > 0 && (
            <div className="space-y-1.5">
              <Label>Procesos adicionales</Label>
              <div className="flex flex-wrap gap-2">
                {allProcesses.map((p) => (
                  <label
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedProcessIds.has(p.id)}
                      onCheckedChange={() => toggleProcess(p.id)}
                    />
                    <span className="text-xs">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{COP(Number(p.cost))}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Alert className="border-primary/30 bg-primary/5">
            <Calculator className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <CostRow label="Costo base" value={COP(baseCost)} />
                <CostRow label={`Tinta (${inkGrams.toFixed(1)} g)`} value={COP(inkCost)} />
                <CostRow label="Impresión" value={COP(printingCost)} />
                <CostRow label="Planchado" value={COP(ironingCost)} />
                <CostRow label="Procesos" value={COP(processCost)} />
                <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                  <span>Costo total</span>
                  <span className="tabular-nums">{COP(totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margen</span>
                  <span className={`tabular-nums ${margin < 0 ? "text-status-red" : "text-status-green"}`}>
                    {COP(margin)} ({marginPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="v-active">Variante activa</Label>
            <Switch id="v-active" checked={active} onCheckedChange={setActive} />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar cambios
            </Button>
            {onRequestDelete && variant && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => onRequestDelete(variant)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <DesignDialog
            open={designDialogOpen}
            onClose={() => setDesignDialogOpen(false)}
            initial={null}
            onCreated={(design) => setDesignId(design.id)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
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
