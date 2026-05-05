import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import type { Product, ProductWithChildren } from "./api";
import { getStockStatus, isAgingFlagged } from "./status";
import { matchesAllTokens } from "@/lib/textSearch";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  parents: ProductWithChildren[];
  orphans: Product[];
  globalFilter: string;
  onEditParent: (p: Product) => void;
  onDeleteParent: (p: ProductWithChildren) => void;
  onEditVariant: (p: Product) => void;
  onDeleteVariant: (p: Product) => void;
}

export function ProductsTable({
  parents,
  orphans,
  globalFilter,
  onEditParent,
  onDeleteParent,
  onEditVariant,
  onDeleteVariant,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filterFn = (p: Product) => {
    if (!globalFilter.trim()) return true;
    return matchesAllTokens(`${p.sku} ${p.name}`, globalFilter);
  };

  const visibleParents = useMemo(
    () => parents.filter((p) => filterFn(p) || p.children.some(filterFn)),
    [parents, globalFilter],
  );
  const visibleOrphans = useMemo(() => orphans.filter(filterFn), [orphans, globalFilter]);

  const toggleRow = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const totalRows = visibleParents.length + visibleOrphans.length;

  return (
    <div className="rounded-md border bg-card">
      <div className="overflow-x-auto">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Variantes</TableHead>
              <TableHead>Stock total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalRows === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  Sin productos para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {visibleParents.map((parent) => {
                  const isOpen = expanded.has(parent.id);
                  const totalStock = parent.children.reduce((acc, c) => acc + Number(c.stock), 0);
                  const anyOut = parent.children.some((c) => getStockStatus(c).tone === "red");
                  const anyCritical = parent.children.some(
                    (c) => getStockStatus(c).tone === "yellow",
                  );
                  return (
                    <>
                      <TableRow
                        key={parent.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => toggleRow(parent.id)}
                      >
                        <TableCell>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{parent.sku}</TableCell>
                        <TableCell className="font-medium">{parent.name}</TableCell>
                        <TableCell className="text-sm">{parent.children.length}</TableCell>
                        <TableCell className="tabular-nums">{totalStock}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {anyOut && <StatusBadge tone="red" label="Agotados" />}
                            {anyCritical && !anyOut && <StatusBadge tone="yellow" label="Crítico" />}
                            {!anyOut && !anyCritical && parent.children.length > 0 && (
                              <StatusBadge tone="green" label="OK" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditParent(parent)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar padre
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDeleteParent(parent)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar todo
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${parent.id}-children`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={7} className="p-0">
                            <ChildrenTable
                              children={parent.children}
                              onEdit={onEditVariant}
                              onDelete={onDeleteVariant}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}

                {visibleOrphans.map((p) => {
                  const s = getStockStatus(p);
                  const flagged = isAgingFlagged(p);
                  return (
                    <TableRow
                      key={p.id}
                      className={cn(flagged && "bg-status-yellow/5 hover:bg-status-yellow/10")}
                    >
                      <TableCell></TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">— legacy —</TableCell>
                      <TableCell className="tabular-nums">{p.stock}</TableCell>
                      <TableCell>
                        <StatusBadge tone={s.tone} label={s.label} />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditVariant(p)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteVariant(p)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ChildrenTable({
  children,
  onEdit,
  onDelete,
}: {
  children: Product[];
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  if (children.length === 0) {
    return (
      <div className="px-6 py-4 text-xs text-muted-foreground">
        Este producto no tiene variantes.
      </div>
    );
  }
  return (
    <div className="px-2 py-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">SKU</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Talla</TableHead>
            <TableHead>Estampado</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Aging</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {children.map((c) => {
            const s = getStockStatus(c);
            const flagged = isAgingFlagged(c);
            return (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.sku}</TableCell>
                <TableCell className="text-sm">{c.base_color ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.size ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.print_design ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{c.stock}</span>
                    <StatusBadge tone={s.tone} label={s.label} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="tabular-nums text-xs">{c.aging_days}d</span>
                    {flagged && <StatusBadge tone="yellow" label="Promo" />}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-sm">{currency(Number(c.price))}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
