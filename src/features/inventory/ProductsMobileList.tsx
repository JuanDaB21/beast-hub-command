import { useState } from "react";
import { Card } from "@/components/ui/card";
import { OverflowMenu } from "@/components/shared/OverflowMenu";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Archive, ArchiveRestore, ChevronDown, LineChart, Merge, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getStockStatus, isAgingFlagged } from "./status";
import type { Product, ProductWithChildren } from "./api";

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

interface Props {
  parents: ProductWithChildren[];
  orphans: Product[];
  onEditParent: (p: Product) => void;
  onDeleteParent: (p: ProductWithChildren) => void;
  onEditVariant: (p: Product) => void;
  onDeleteVariant: (p: Product) => void;
  onMergeVariant: (p: Product) => void;
  onShowProfit: (p: ProductWithChildren) => void;
  onArchiveParent: (p: ProductWithChildren) => void;
  archivedView: boolean;
}

export function ProductsMobileList({
  parents,
  orphans,
  onEditParent,
  onDeleteParent,
  onEditVariant,
  onDeleteVariant,
  onMergeVariant,
  onShowProfit,
  onArchiveParent,
  archivedView,
}: Props) {
  if (parents.length === 0 && orphans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Sin productos para mostrar.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {parents.map((p) => (
        <ParentCard
          key={p.id}
          parent={p}
          onEditParent={onEditParent}
          onDeleteParent={onDeleteParent}
          onEditVariant={onEditVariant}
          onDeleteVariant={onDeleteVariant}
          onMergeVariant={onMergeVariant}
          onShowProfit={onShowProfit}
          onArchiveParent={onArchiveParent}
          archivedView={archivedView}
        />
      ))}
      {orphans.map((p) => {
        const s = getStockStatus(p);
        const aging = isAgingFlagged(p);
        return (
          <Card key={p.id} className="p-0">
            <VariantRow
              title={p.name}
              sku={p.sku}
              stock={Number(p.stock)}
              tone={s.tone}
              statusLabel={s.label}
              meta={[currency(Number(p.price)), aging ? `Aging ${p.aging_days} d` : null]}
              onEdit={() => onEditVariant(p)}
              onMerge={() => onMergeVariant(p)}
              onDelete={() => onDeleteVariant(p)}
            />
          </Card>
        );
      })}
    </div>
  );
}

function ParentCard({
  parent,
  onEditParent,
  onDeleteParent,
  onEditVariant,
  onDeleteVariant,
  onMergeVariant,
  onShowProfit,
  onArchiveParent,
  archivedView,
}: {
  parent: ProductWithChildren;
  onEditParent: (p: Product) => void;
  onDeleteParent: (p: ProductWithChildren) => void;
  onEditVariant: (p: Product) => void;
  onDeleteVariant: (p: Product) => void;
  onMergeVariant: (p: Product) => void;
  onShowProfit: (p: ProductWithChildren) => void;
  onArchiveParent: (p: ProductWithChildren) => void;
  archivedView: boolean;
}) {
  const [open, setOpen] = useState(false);
  const totalStock = parent.children.reduce((a, c) => a + Number(c.stock), 0);
  const outCount = parent.children.filter((c) => getStockStatus(c).tone === "red").length;
  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-1 pr-1">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left active:bg-surface-2">
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-base ease-out-quint", !open && "-rotate-90")}
            />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 font-medium leading-snug">{parent.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {parent.children.length} variantes
                {outCount > 0 && <span className="text-danger-ink">, {outCount} agotada{outCount === 1 ? "" : "s"}</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular font-display text-2xl font-semibold leading-none">{totalStock}</div>
              <div className="text-2xs text-muted-foreground">en stock</div>
            </div>
          </CollapsibleTrigger>
          <OverflowMenu
            label={`Acciones de ${parent.name}`}
            items={[
              { label: "Editar producto", icon: Pencil, onSelect: () => onEditParent(parent) },
              { label: "Costo y rentabilidad", icon: LineChart, onSelect: () => onShowProfit(parent) },
              {
                label: archivedView ? "Restaurar" : "Archivar",
                icon: archivedView ? ArchiveRestore : Archive,
                onSelect: () => onArchiveParent(parent),
              },
              { label: "Eliminar con variantes", icon: Trash2, destructive: true, onSelect: () => onDeleteParent(parent) },
            ]}
          />
        </div>
        <CollapsibleContent className="divide-y border-t bg-surface-2/60">
          {parent.children.length === 0 ? (
            <p className="p-3.5 text-xs text-muted-foreground">Sin variantes.</p>
          ) : (
            parent.children.map((c) => {
              const s = getStockStatus(c);
              return (
                <VariantRow
                  key={c.id}
                  title={[c.base_color, c.size, c.print_design].filter(Boolean).join(", ")}
                  sku={c.sku}
                  stock={Number(c.stock)}
                  tone={s.tone}
                  statusLabel={s.label}
                  meta={[currency(Number(c.price)), `Aging ${c.aging_days} d`]}
                  onEdit={() => onEditVariant(c)}
                  onMerge={() => onMergeVariant(c)}
                  onDelete={() => onDeleteVariant(c)}
                />
              );
            })
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

const stockTone = { green: "text-foreground", yellow: "text-warning-ink dark:text-warning", red: "text-danger", neutral: "text-foreground", info: "text-foreground" } as const;

/** Fila de variante: tocar abre edición; fusionar/eliminar en el menú. */
function VariantRow({
  title,
  sku,
  stock,
  tone,
  statusLabel,
  meta,
  onEdit,
  onMerge,
  onDelete,
}: {
  title: string;
  sku: string;
  stock: number;
  tone: keyof typeof stockTone;
  statusLabel: string;
  meta: (string | null)[];
  onEdit: () => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1 pr-1">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left active:bg-surface-3">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-medium">{title}</div>
          <div className="tabular mt-0.5 truncate text-xs text-muted-foreground">
            {[sku, ...meta].filter(Boolean).join(", ")}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn("tabular font-display text-xl font-semibold leading-none", stockTone[tone])}>{stock}</div>
          <div className="text-2xs text-muted-foreground">{statusLabel}</div>
        </div>
      </button>
      <OverflowMenu
        label={`Acciones de ${title}`}
        items={[
          { label: "Editar variante", icon: Pencil, onSelect: onEdit },
          { label: "Fusionar", icon: Merge, onSelect: onMerge },
          { label: "Eliminar", icon: Trash2, destructive: true, onSelect: onDelete },
        ]}
      />
    </div>
  );
}
