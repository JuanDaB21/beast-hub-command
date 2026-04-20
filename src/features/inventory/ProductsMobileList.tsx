import { EntityDetailCard } from "@/components/shared/EntityDetailCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProductDetails } from "./ProductDetails";
import { getStockStatus, isAgingFlagged } from "./status";
import type { Product } from "./api";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  products: Product[];
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}

/** Vista alternativa de tarjetas para móvil (lg:hidden en página). */
export function ProductsMobileList({ products, onEdit, onDelete }: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Sin productos para mostrar.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {products.map((p) => {
        const stock = getStockStatus(p);
        const aging = isAgingFlagged(p);
        return (
          <EntityDetailCard
            key={p.id}
            title={p.name}
            subtitle={p.sku}
            detailsTitle={p.name}
            detailsDescription={`SKU ${p.sku}`}
            summary={
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={stock.tone} label={`${stock.label} · ${p.stock}`} />
                  {aging && <StatusBadge tone="yellow" label={`Aging ${p.aging_days}d`} />}
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span className="font-medium">{currency(Number(p.price))}</span>
                  <span className="text-xs text-muted-foreground">Seg.: {p.safety_stock}</span>
                </div>
              </div>
            }
            details={
              <div className="space-y-4">
                <ProductDetails product={p} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(p)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => onDelete(p)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </Button>
                </div>
              </div>
            }
          />
        );
      })}
    </div>
  );
}
