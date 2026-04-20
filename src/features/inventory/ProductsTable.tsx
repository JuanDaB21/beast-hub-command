import { useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
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
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import type { Product } from "./api";
import { getStockStatus, isAgingFlagged } from "./status";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  data: Product[];
  globalFilter: string;
  onRowClick: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}

export function ProductsTable({ data, globalFilter, onRowClick, onEdit, onDelete }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }]);

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "sku",
        header: ({ column }) => <SortHeader column={column} label="SKU" />,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span>,
      },
      {
        accessorKey: "name",
        header: ({ column }) => <SortHeader column={column} label="Nombre" />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "stock",
        header: ({ column }) => <SortHeader column={column} label="Stock" />,
        cell: ({ row }) => {
          const p = row.original;
          const s = getStockStatus(p);
          return (
            <div className="flex items-center gap-2">
              <span className="tabular-nums">{p.stock}</span>
              <StatusBadge tone={s.tone} label={s.label} />
            </div>
          );
        },
      },
      {
        accessorKey: "safety_stock",
        header: ({ column }) => <SortHeader column={column} label="Seguridad" />,
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.safety_stock}</span>,
      },
      {
        accessorKey: "aging_days",
        header: ({ column }) => <SortHeader column={column} label="Aging" />,
        cell: ({ row }) => {
          const p = row.original;
          const flagged = isAgingFlagged(p);
          return (
            <div className="flex items-center gap-2">
              <span className="tabular-nums">{p.aging_days}d</span>
              {flagged && <StatusBadge tone="yellow" label="Promo sugerida" />}
            </div>
          );
        },
      },
      {
        accessorKey: "price",
        header: ({ column }) => <SortHeader column={column} label="Precio" />,
        cell: ({ row }) => <span className="tabular-nums">{currency(Number(row.original.price))}</span>,
      },
      {
        accessorKey: "active",
        header: "Estado",
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.active ? "green" : "neutral"}
            label={row.original.active ? "Activo" : "Inactivo"}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Acciones</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(p)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(p)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onEdit, onDelete],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, value) => {
      const v = String(value ?? "").toLowerCase();
      if (!v) return true;
      return (
        row.original.sku.toLowerCase().includes(v) ||
        row.original.name.toLowerCase().includes(v)
      );
    },
  });

  return (
    <div className="rounded-md border bg-card">
      <div className="overflow-x-auto">
        <Table className="min-w-[820px]">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  Sin productos para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const flagged = isAgingFlagged(row.original);
                return (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick(row.original)}
                    className={cn(
                      "cursor-pointer",
                      flagged && "bg-status-yellow/5 hover:bg-status-yellow/10",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortHeader<TData>({
  column,
  label,
}: {
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1 px-2 font-medium"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
    </Button>
  );
}
