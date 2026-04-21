import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getStockStatus, isAgingFlagged } from "./status";
import type { Product, ProductWithChildren } from "./api";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  parents: ProductWithChildren[];
  orphans: Product[];
  onEditParent: (p: Product) => void;
  onDeleteParent: (p: ProductWithChildren) => void;
  onEditVariant: (p: Product) => void;
  onDeleteVariant: (p: Product) => void;
}

export function ProductsMobileList({
  parents,
  orphans,
  onEditParent,
  onDeleteParent,
  onEditVariant,
  onDeleteVariant,
}: Props) {
  if (parents.length === 0 && orphans.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Sin productos para mostrar.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {parents.map((p) => (
        <ParentCard
          key={p.id}
          parent={p}
          onEditParent={onEditParent}
          onDeleteParent={onDeleteParent}
          onEditVariant={onEditVariant}
          onDeleteVariant={onDeleteVariant}
        />
      ))}
      {orphans.map((p) => {
        const s = getStockStatus(p);
        const aging = isAgingFlagged(p);
        return (
          <Card key={p.id} className="p-3 space-y-2">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs font-mono text-muted-foreground">{p.sku}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone={s.tone} label={`${s.label} · ${p.stock}`} />
              {aging && <StatusBadge tone="yellow" label={`Aging ${p.aging_days}d`} />}
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{currency(Number(p.price))}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onEditVariant(p)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => onDeleteVariant(p)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </Button>
            </div>
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
}: {
  parent: ProductWithChildren;
  onEditParent: (p: Product) => void;
  onDeleteParent: (p: ProductWithChildren) => void;
  onEditVariant: (p: Product) => void;
  onDeleteVariant: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalStock = parent.children.reduce((a, c) => a + Number(c.stock), 0);
  const anyOut = parent.children.some((c) => getStockStatus(c).tone === "red");
  return (
    <Card className="p-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start justify-between gap-2">
          <CollapsibleTrigger className="flex flex-1 items-start gap-2 text-left">
            {open ? (
              <ChevronDown className="h-4 w-4 mt-1 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-1 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{parent.name}</div>
              <div className="text-xs font-mono text-muted-foreground">{parent.sku}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <StatusBadge
                  tone={anyOut ? "red" : "neutral"}
                  label={`${parent.children.length} variantes · stock ${totalStock}`}
                />
              </div>
            </div>
          </CollapsibleTrigger>
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onEditParent(parent)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Padre
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => onDeleteParent(parent)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Todo
          </Button>
        </div>
        <CollapsibleContent className="mt-3 space-y-2 border-t pt-3">
          {parent.children.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin variantes.</p>
          ) : (
            parent.children.map((c) => {
              const s = getStockStatus(c);
              return (
                <div key={c.id} className="rounded-md border bg-muted/20 p-2 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.base_color} · {c.size} {c.print_design ? `· ${c.print_design}` : ""}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">{c.sku}</div>
                    </div>
                    <StatusBadge tone={s.tone} label={`${s.label} · ${c.stock}`} />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Aging {c.aging_days}d</span>
                    <span className="font-medium">{currency(Number(c.price))}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1"
                      onClick={() => onEditVariant(c)}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 text-destructive hover:text-destructive"
                      onClick={() => onDeleteVariant(c)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
