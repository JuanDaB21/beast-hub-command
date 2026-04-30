import { useMemo, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useRawMaterials } from "@/features/sourcing/api";
import { groupMaterials, type MaterialGroup } from "@/features/sourcing/groupHelpers";
import { usePrintDesigns } from "@/features/print-designs/api";
import { toast } from "@/hooks/use-toast";
import {
  useLinkPreview,
  useSetBaseGroup,
  useBulkLink,
  type UnlinkedParent,
  type LinkPreviewItem,
  type BulkLinkItem,
} from "./api";

interface Props {
  parent: UnlinkedParent | null;
  open: boolean;
  onClose: () => void;
}

export function LinkingWizard({ parent, open, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [printHeight, setPrintHeight] = useState(0);

  // Step 2 state: overrides per product_id
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [preview, setPreview] = useState<LinkPreviewItem[]>([]);

  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: printDesigns = [] } = usePrintDesigns({ active: true });
  const groups = useMemo(() => groupMaterials(rawMaterials), [rawMaterials]);
  const selectedGroup = useMemo(() => groups.find((g) => g.key === selectedGroupKey) ?? null, [groups, selectedGroupKey]);

  const linkPreview = useLinkPreview();
  const setBaseGroup = useSetBaseGroup();
  const bulkLink = useBulkLink();

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: g.key,
        label: `${g.baseName} · ${g.supplier?.name ?? "Sin proveedor"} · ${g.variants.length} variantes`,
      })),
    [groups]
  );

  const designOptions = useMemo(
    () => [
      { value: "", label: "Sin estampado" },
      ...printDesigns.map((d) => ({ value: d.id, label: d.name })),
    ],
    [printDesigns]
  );

  // All raw_material options (for manual override in step 2)
  const rmOptions = useMemo(
    () =>
      rawMaterials.map((rm) => ({
        value: rm.id,
        label: `${rm.name} (stock: ${rm.stock})`,
      })),
    [rawMaterials]
  );

  function reset() {
    setStep(1);
    setSelectedGroupKey(null);
    setSelectedDesignId(null);
    setPrintHeight(0);
    setOverrides(new Map());
    setPreview([]);
  }

  async function handleStep1Next() {
    if (!parent || !selectedGroupKey) return;
    try {
      const result = await linkPreview.mutateAsync({
        parent_id: parent.parent_id,
        base_group_key: selectedGroupKey,
        print_design_id: selectedDesignId || null,
        print_height_cm: printHeight,
      });
      setPreview(result.previews);
      setStep(2);
    } catch (err) {
      toast({ title: "Error al previsualizar", description: String(err), variant: "destructive" });
    }
  }

  async function handleStep2Next() {
    setStep(3);
  }

  async function handleConfirm() {
    if (!parent || !selectedGroupKey) return;
    const items: BulkLinkItem[] = [];
    for (const p of preview) {
      const rmId = overrides.get(p.product_id) ?? p.raw_material_id;
      if (!rmId) continue;
      items.push({
        product_id: p.product_id,
        raw_material_id: rmId,
        print_design_id: selectedDesignId || null,
        print_height_cm: printHeight,
      });
    }
    if (items.length === 0) {
      toast({ title: "Nada que vincular", description: "Todas las variantes están sin base asignada.", variant: "destructive" });
      return;
    }

    try {
      // Persist base_group_key on parent (enables auto-link in future syncs)
      await setBaseGroup.mutateAsync({
        parent_id: parent.parent_id,
        base_group_key: selectedGroupKey,
        print_design_id: selectedDesignId || null,
        print_height_cm: printHeight,
      });
      // Bulk link with any manual overrides
      const result = await bulkLink.mutateAsync(items);
      toast({
        title: "Vinculación completa",
        description: `${result.linked} variante(s) vinculadas. ${result.errors.length > 0 ? `${result.errors.length} errores.` : ""}`,
      });
      reset();
      onClose();
    } catch (err) {
      toast({ title: "Error al vincular", description: String(err), variant: "destructive" });
    }
  }

  function setOverride(productId: string, rmId: string | null) {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (rmId) next.set(productId, rmId);
      else next.delete(productId);
      return next;
    });
  }

  const canProceedStep1 = !!selectedGroupKey;
  const resolvedCount = preview.filter((p) => (overrides.get(p.product_id) ?? p.raw_material_id) !== null).length;
  const isPending = linkPreview.isPending || setBaseGroup.isPending || bulkLink.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Vincular a base + BOM — {parent?.parent_name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Paso {step} de 3</p>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Base (raw material group) *</Label>
              <StandardCombobox
                options={groupOptions}
                value={selectedGroupKey}
                onChange={setSelectedGroupKey}
                placeholder="Selecciona la base..."
                searchPlaceholder="Buscar base..."
                emptyText="No hay bases. Créalas en Proveedores."
              />
            </div>

            {selectedGroup && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-medium">{selectedGroup.baseName}</p>
                <p className="text-muted-foreground">
                  {selectedGroup.variants.length} variante(s) disponible(s) ·{" "}
                  {[...new Set(selectedGroup.variants.map((v) => v.color?.name).filter(Boolean))].join(", ")}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Estampado por defecto (opcional)</Label>
              <StandardCombobox
                options={designOptions}
                value={selectedDesignId ?? ""}
                onChange={(v) => setSelectedDesignId(v || null)}
                placeholder="Sin estampado"
                searchPlaceholder="Buscar estampado..."
                emptyText="No hay estampados."
              />
            </div>

            {selectedDesignId && (
              <div className="space-y-1.5">
                <Label>Altura de estampado (cm)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={printHeight}
                  onChange={(e) => setPrintHeight(Number(e.target.value))}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button onClick={handleStep1Next} disabled={!canProceedStep1 || isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Previsualizar →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Revisá la resolución automática. Las variantes con ✗ necesitan un raw_material manual.
            </p>
            <div className="space-y-2">
              {preview.map((p) => {
                const overrideRm = overrides.get(p.product_id) ?? null;
                const resolved = overrideRm ?? p.raw_material_id;
                return (
                  <div key={p.product_id} className="rounded border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{p.sku}</p>
                        <p className="text-xs text-muted-foreground">
                          {[p.base_color, p.size].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {resolved ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> Sin match
                        </Badge>
                      )}
                    </div>

                    {!p.can_link && (
                      <div className="space-y-1">
                        <Label className="text-xs">Asignar raw_material manualmente</Label>
                        <StandardCombobox
                          options={rmOptions}
                          value={overrideRm ?? ""}
                          onChange={(v) => setOverride(p.product_id, v || null)}
                          placeholder="Seleccionar base..."
                          searchPlaceholder="Buscar..."
                          emptyText="Sin resultados"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {resolvedCount < preview.length && (
              <div className="flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {preview.length - resolvedCount} variante(s) sin base asignada serán omitidas.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Atrás</Button>
              <Button onClick={handleStep2Next} disabled={resolvedCount === 0}>
                Confirmar ({resolvedCount} variante{resolvedCount !== 1 ? "s" : ""}) →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
              <p className="font-medium">Resumen de la vinculación</p>
              <div className="space-y-1 text-muted-foreground">
                <p>Producto: <span className="text-foreground font-medium">{parent?.parent_name}</span></p>
                <p>Base: <span className="text-foreground font-medium">{selectedGroup?.baseName}</span></p>
                <p>Estampado: <span className="text-foreground font-medium">{printDesigns.find((d) => d.id === selectedDesignId)?.name ?? "Ninguno"}</span></p>
                {selectedDesignId && <p>Altura: <span className="text-foreground font-medium">{printHeight} cm</span></p>}
                <p>Variantes a vincular: <span className="text-foreground font-medium">{resolvedCount}</span></p>
                <p className="text-xs">Se crearán filas en product_materials (BOM) para cada variante.</p>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>← Atrás</Button>
              <Button onClick={handleConfirm} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Vincular y guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
