import { StatusBadge } from "@/components/shared/StatusBadge";
import { getStockStatus, isAgingFlagged, AGING_THRESHOLD_DAYS } from "./status";
import type { Product } from "./api";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export function ProductDetails({ product }: { product: Product }) {
  const stock = getStockStatus(product);
  const aging = isAgingFlagged(product);
  const margin = Number(product.price) - Number(product.cost);
  const marginPct = product.price > 0 ? (margin / Number(product.price)) * 100 : 0;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={stock.tone} label={stock.label} />
        {aging && <StatusBadge tone="yellow" label={`Aging ${product.aging_days}d`} />}
        <StatusBadge tone={product.active ? "green" : "neutral"} label={product.active ? "Activo" : "Inactivo"} />
      </div>

      {product.description && (
        <p className="rounded-md bg-muted/40 p-3 text-muted-foreground">{product.description}</p>
      )}

      <Row label="SKU" value={product.sku} />
      <Row label="Nombre" value={product.name} />
      <Row label="Stock actual" value={String(product.stock)} />
      <Row label="Stock de seguridad" value={String(product.safety_stock)} />
      <Row label="Aging" value={`${product.aging_days} días (umbral: ${AGING_THRESHOLD_DAYS}d)`} />
      <Row label="Precio" value={currency(Number(product.price))} />
      <Row label="Costo" value={currency(Number(product.cost))} />
      <Row label="Margen" value={`${currency(margin)} (${marginPct.toFixed(1)}%)`} />
      <Row label="Creado" value={new Date(product.created_at).toLocaleString("es-MX")} />
      <Row label="Actualizado" value={new Date(product.updated_at).toLocaleString("es-MX")} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
