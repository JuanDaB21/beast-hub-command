import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Plus, Search } from "lucide-react";
import { useDeleteProduct, useProducts, type Product } from "@/features/inventory/api";
import { ProductsTable } from "@/features/inventory/ProductsTable";
import { ProductsMobileList } from "@/features/inventory/ProductsMobileList";
import { ProductForm } from "@/features/inventory/ProductForm";
import { ProductDetails } from "@/features/inventory/ProductDetails";
import { getStockStatus, isAgingFlagged } from "@/features/inventory/status";
import { toast } from "@/hooks/use-toast";

export default function Inventory() {
  const { data: products = [], isLoading } = useProducts();
  const del = useDeleteProduct();

  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const stats = useMemo(() => {
    const total = products.length;
    let outOfStock = 0;
    let critical = 0;
    let aging = 0;
    products.forEach((p) => {
      const s = getStockStatus(p);
      if (s.tone === "red") outOfStock++;
      else if (s.tone === "yellow") critical++;
      if (isAgingFlagged(p)) aging++;
    });
    return { total, outOfStock, critical, aging };
  }, [products]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setDetail(null);
    setFormOpen(true);
  };
  const openDetail = (p: Product) => setDetail(p);
  const askDelete = (p: Product) => {
    setDetail(null);
    setConfirmDelete(p);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast({ title: "Producto eliminado" });
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setConfirmDelete(null);
    }
  };

  const headerActions = (
    <Button size="sm" className="gap-2" onClick={openCreate}>
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Nuevo producto</span>
    </Button>
  );

  return (
    <AppShell
      title="Módulo 1 · Inventario"
      description="Catálogo de productos finales, stock y aging."
      actions={headerActions}
    >
      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Productos" value={stats.total} />
        <KPI label="Agotados" value={stats.outOfStock} tone="red" />
        <KPI label="Stock crítico" value={stats.critical} tone="yellow" />
        <KPI label="En aging" value={stats.aging} tone="yellow" />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por SKU o nombre..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden">
            <ProductsMobileList
              products={products.filter((p) => {
                const v = filter.toLowerCase();
                return !v || p.sku.toLowerCase().includes(v) || p.name.toLowerCase().includes(v);
              })}
              onEdit={openEdit}
              onDelete={askDelete}
            />
          </div>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <ProductsTable
              data={products}
              globalFilter={filter}
              onRowClick={openDetail}
              onEdit={openEdit}
              onDelete={askDelete}
            />
          </div>
        </>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              {editing ? "Actualiza los datos del producto." : "Registra un producto final."}
            </DialogDescription>
          </DialogHeader>
          <ProductForm product={editing} onSuccess={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Detail drawer (desktop row click) */}
      <Drawer open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-2xl">
            <DrawerHeader>
              <DrawerTitle>{detail?.name}</DrawerTitle>
              <DrawerDescription>SKU {detail?.sku}</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4 px-4 pb-8">
              {detail && <ProductDetails product={detail} />}
              {detail && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => openEdit(detail)}>
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => askDelete(detail)}
                  >
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{confirmDelete?.name}</strong> ({confirmDelete?.sku}). Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function KPI({ label, value, tone }: { label: string; value: number; tone?: "red" | "yellow" }) {
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
