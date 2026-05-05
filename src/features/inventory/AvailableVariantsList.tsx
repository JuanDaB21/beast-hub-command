import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getStockStatus, isAgingFlagged } from "./status";
import type { Product, ProductWithChildren } from "./api";
import { matchesAllTokens } from "@/lib/textSearch";

interface Props {
  parents: ProductWithChildren[];
  orphans: Product[];
}

interface Row extends Product {
  parentName: string | null;
}

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export function AvailableVariantsList({ parents, orphans }: Props) {
  const [filter, setFilter] = useState("");

  const allRows: Row[] = useMemo(() => {
    const fromParents: Row[] = parents.flatMap((p) =>
      p.children.map((c) => ({ ...c, parentName: p.name })),
    );
    const fromOrphans: Row[] = orphans.map((p) => ({ ...p, parentName: null }));
    return [...fromParents, ...fromOrphans]
      .filter((r) => r.active && r.stock > 0)
      .sort((a, b) => b.stock - a.stock);
  }, [parents, orphans]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return allRows;
    return allRows.filter((r) =>
      matchesAllTokens(`${r.sku} ${r.name} ${r.parentName ?? ""}`, filter),
    );
  }, [allRows, filter]);

  const stats = useMemo(() => {
    const totalStock = filtered.reduce((sum, r) => sum + r.stock, 0);
    const aging = filtered.filter((r) => isAgingFlagged(r)).length;
    return { count: filtered.length, totalStock, aging };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Variantes disponibles" value={stats.count} />
        <KPI label="Stock total" value={stats.totalStock} />
        <KPI label="En aging" value={stats.aging} tone={stats.aging > 0 ? "yellow" : undefined} />
      </div>

      <div className="relative sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar por SKU, nombre o producto padre..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No hay variantes disponibles con stock.
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((r) => {
              const stock = getStockStatus(r);
              const aging = isAgingFlagged(r);
              return (
                <Card key={r.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.sku}</p>
                      {r.parentName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.parentName}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">{r.stock}</div>
                      <div className="text-xs text-muted-foreground">
                        {currency(r.price)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={stock.tone} label={stock.label} />
                    {aging && <StatusBadge tone="yellow" label="Aging" />}
                    {r.print_design && (
                      <Badge variant="outline" className="text-xs">
                        {r.print_design}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto padre</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Estampado</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Aging</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const stock = getStockStatus(r);
                  const aging = isAgingFlagged(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                      <TableCell className="text-sm">
                        {r.parentName ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{r.base_color ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.size ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.print_design ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {r.stock}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={stock.tone} label={stock.label} />
                      </TableCell>
                      <TableCell>
                        {aging ? (
                          <StatusBadge tone="yellow" label={`${r.aging_days}d`} />
                        ) : (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {r.aging_days}d
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {currency(r.price)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "red" | "yellow";
}) {
  const toneClass =
    tone === "red"
      ? "text-status-red"
      : tone === "yellow"
        ? "text-status-yellow"
        : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </Card>
  );
}
