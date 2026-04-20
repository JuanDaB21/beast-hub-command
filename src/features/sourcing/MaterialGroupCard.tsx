import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { cn } from "@/lib/utils";
import {
  type RawMaterialWithRelations,
  useDeleteRawMaterial,
} from "@/features/sourcing/api";
import { EditRawMaterialDialog } from "@/features/sourcing/EditRawMaterialDialog";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export interface MaterialGroup {
  key: string;
  baseName: string;
  supplier: RawMaterialWithRelations["supplier"];
  category: RawMaterialWithRelations["category"];
  subcategory: RawMaterialWithRelations["subcategory"];
  variants: RawMaterialWithRelations[];
}

/** Extracts the base name by stripping color & size suffixes from the variant name. */
export function extractBaseName(m: RawMaterialWithRelations): string {
  let name = m.name;
  const stripSuffix = (text: string, suffix?: string | null) => {
    if (!suffix) return text;
    const re = new RegExp(`\\s*-\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    return text.replace(re, "");
  };
  // Try stripping size first, then color (matches "Base - Color - Size" order)
  name = stripSuffix(name, m.size?.label);
  name = stripSuffix(name, m.color?.name);
  return name.trim();
}

/** Groups raw materials by supplier + category + base name. */
export function groupMaterials(materials: RawMaterialWithRelations[]): MaterialGroup[] {
  const map = new Map<string, MaterialGroup>();
  materials.forEach((m) => {
    const baseName = extractBaseName(m);
    const key = `${m.supplier_id}::${m.category_id}::${baseName.toLowerCase()}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        baseName,
        supplier: m.supplier,
        category: m.category,
        subcategory: m.subcategory,
        variants: [],
      };
      map.set(key, g);
    }
    g.variants.push(m);
  });

  // Sort variants inside each group: size.sort_order, then color name
  map.forEach((g) => {
    g.variants.sort((a, b) => {
      const so = (a.size?.sort_order ?? 9999) - (b.size?.sort_order ?? 9999);
      if (so !== 0) return so;
      return (a.color?.name ?? "").localeCompare(b.color?.name ?? "");
    });
  });

  return Array.from(map.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
}

interface Props {
  group: MaterialGroup;
}

export function MaterialGroupCard({ group }: Props) {
  const [open, setOpen] = useState(false);
  const [detailVariant, setDetailVariant] = useState<RawMaterialWithRelations | null>(null);
  const [editVariant, setEditVariant] = useState<RawMaterialWithRelations | null>(null);
  const [deleteVariant, setDeleteVariant] = useState<RawMaterialWithRelations | null>(null);
  const deleteMut = useDeleteRawMaterial();

  const handleDelete = async () => {
    if (!deleteVariant) return;
    try {
      await deleteMut.mutateAsync(deleteVariant.id);
      toast.success("Variante eliminada");
      setDeleteVariant(null);
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo eliminar (puede estar en uso)");
    }
  };

  const totalStock = useMemo(
    () => group.variants.reduce((s, v) => s + Number(v.stock ?? 0), 0),
    [group.variants],
  );
  const anyOutOfStock = group.variants.some((v) => Number(v.stock) <= 0);

  const uniqueColors = useMemo(() => {
    const seen = new Map<string, { name: string; hex: string | null }>();
    group.variants.forEach((v) => {
      if (v.color) seen.set(v.color.id, { name: v.color.name, hex: v.color.hex_code });
    });
    return Array.from(seen.values());
  }, [group.variants]);

  const uniqueSizes = useMemo(() => {
    const seen = new Map<string, { label: string; sort: number }>();
    group.variants.forEach((v) => {
      if (v.size) seen.set(v.size.id, { label: v.size.label, sort: v.size.sort_order });
    });
    return Array.from(seen.values()).sort((a, b) => a.sort - b.sort);
  }, [group.variants]);

  return (
    <>
      <Card className="overflow-hidden">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-base font-semibold">{group.baseName}</h3>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {group.variants.length} variante{group.variants.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {group.supplier?.name ?? "—"}
                  {group.category && <> · {group.category.name}</>}
                  {group.subcategory && <> / {group.subcategory.name}</>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {uniqueColors.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                    >
                      {c.hex && (
                        <span
                          className="h-2 w-2 rounded-full border"
                          style={{ backgroundColor: c.hex }}
                        />
                      )}
                      {c.name}
                    </span>
                  ))}
                  {uniqueSizes.map((s) => (
                    <span
                      key={s.label}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <StatusBadge
                    tone={anyOutOfStock ? "red" : "green"}
                    label={`Stock total: ${totalStock}`}
                  />
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.variants.map((v) => {
                    const lowStock = Number(v.stock) <= 0;
                    return (
                      <TableRow key={v.id}>
                        <TableCell>
                          {v.color ? (
                            <span className="inline-flex items-center gap-1.5">
                              {v.color.hex_code && (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border"
                                  style={{ backgroundColor: v.color.hex_code }}
                                />
                              )}
                              {v.color.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {v.size?.label ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {v.sku ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {currency(Number(v.unit_price))}
                          <span className="text-xs text-muted-foreground">/{v.unit_of_measure}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge
                            tone={lowStock ? "red" : "green"}
                            label={String(v.stock)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDetailVariant(v)}
                            >
                              Ver
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditVariant(v)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteVariant(v)}
                              aria-label="Eliminar"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Drawer
        open={!!detailVariant}
        onOpenChange={(o) => !o && setDetailVariant(null)}
      >
        <DrawerContent>
          <div className="mx-auto w-full max-w-2xl">
            <DrawerHeader>
              <DrawerTitle>{detailVariant?.name}</DrawerTitle>
              <DrawerDescription>
                {detailVariant?.supplier?.name ?? "Sin proveedor"}
              </DrawerDescription>
            </DrawerHeader>
            {detailVariant && (
              <div className="space-y-3 px-4 pb-8 text-sm">
                <DetailRow label="Proveedor" value={detailVariant.supplier?.name ?? "—"} />
                <DetailRow label="Categoría" value={detailVariant.category?.name ?? "—"} />
                <DetailRow label="Subcategoría" value={detailVariant.subcategory?.name ?? "—"} />
                <DetailRow label="Color" value={detailVariant.color?.name ?? "—"} />
                <DetailRow label="Talla" value={detailVariant.size?.label ?? "—"} />
                <DetailRow label="SKU" value={detailVariant.sku ?? "—"} />
                <DetailRow
                  label="Precio"
                  value={`${currency(Number(detailVariant.unit_price))} / ${detailVariant.unit_of_measure}`}
                />
                <DetailRow label="Stock" value={String(detailVariant.stock)} />
                {detailVariant.supplier?.contact_phone && (
                  <div className="pt-2">
                    <WhatsAppContactButton
                      phone={detailVariant.supplier.contact_phone}
                      message={`Hola ${detailVariant.supplier.name}, consulta sobre ${detailVariant.name}.`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <EditRawMaterialDialog
        material={editVariant}
        open={!!editVariant}
        onOpenChange={(o) => !o && setEditVariant(null)}
      />

      <AlertDialog
        open={!!deleteVariant}
        onOpenChange={(o) => !o && setDeleteVariant(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta variante?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <span className="font-medium">{deleteVariant?.name}</span>.
              Esta acción no se puede deshacer. Si la variante está usada en
              recetas o solicitudes, la eliminación fallará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
