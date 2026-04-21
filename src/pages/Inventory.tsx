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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import {
  useDeleteProduct,
  useDeleteProductTree,
  useProductTree,
  type Product,
  type ProductWithChildren,
} from "@/features/inventory/api";
import { ProductsTable } from "@/features/inventory/ProductsTable";
import { ProductsMobileList } from "@/features/inventory/ProductsMobileList";
import { ProductForm } from "@/features/inventory/ProductForm";
import { VariantEditDialog } from "@/features/inventory/VariantEditDialog";
import { AvailableVariantsList } from "@/features/inventory/AvailableVariantsList";
import { getStockStatus, isAgingFlagged } from "@/features/inventory/status";
import { toast } from "@/hooks/use-toast";

export default function Inventory() {
  const { parents, orphans, isLoading } = useProductTree();
  const delOne = useDeleteProduct();
  const delTree = useDeleteProductTree();

  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<Product | null>(null);
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState<Product | null>(null);
  const [confirmDeleteTree, setConfirmDeleteTree] = useState<ProductWithChildren | null>(null);

  // KPIs sumando hijos + huérfanos
  const stats = useMemo(() => {
    const allItems: Product[] = [...orphans, ...parents.flatMap((p) => p.children)];
    let outOfStock = 0;
    let critical = 0;
    let aging = 0;
    allItems.forEach((p) => {
      const s = getStockStatus(p);
      if (s.tone === "red") outOfStock++;
      else if (s.tone === "yellow") critical++;
      if (isAgingFlagged(p)) aging++;
    });
    return {
      totalParents: parents.length + orphans.length,
      totalVariants: allItems.length,
      outOfStock,
      critical,
      aging,
    };
  }, [parents, orphans]);

  const handleDeleteVariant = async () => {
    if (!confirmDeleteVariant) return;
    try {
      await delOne.mutateAsync(confirmDeleteVariant.id);
      toast({ title: "Eliminado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConfirmDeleteVariant(null);
    }
  };

  const handleDeleteTree = async () => {
    if (!confirmDeleteTree) return;
    try {
      await delTree.mutateAsync(confirmDeleteTree.id);
      toast({ title: "Producto y variantes eliminados" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConfirmDeleteTree(null);
    }
  };

  const headerActions = (
    <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Nuevo producto</span>
    </Button>
  );

  return (
    <AppShell
      title="Módulo 1 · Inventario"
      description="Productos padre con variantes (color × talla × estampado)."
      actions={headerActions}
    >
      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPI label="Productos padre" value={stats.totalParents} />
        <KPI label="Variantes" value={stats.totalVariants} />
        <KPI label="Agotadas" value={stats.outOfStock} tone="red" />
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="lg:hidden">
            <ProductsMobileList
              parents={parents.filter(
                (p) =>
                  !filter ||
                  p.name.toLowerCase().includes(filter.toLowerCase()) ||
                  p.sku.toLowerCase().includes(filter.toLowerCase()) ||
                  p.children.some(
                    (c) =>
                      c.name.toLowerCase().includes(filter.toLowerCase()) ||
                      c.sku.toLowerCase().includes(filter.toLowerCase()),
                  ),
              )}
              orphans={orphans.filter(
                (p) =>
                  !filter ||
                  p.name.toLowerCase().includes(filter.toLowerCase()) ||
                  p.sku.toLowerCase().includes(filter.toLowerCase()),
              )}
              onEditParent={setEditingParent}
              onDeleteParent={setConfirmDeleteTree}
              onEditVariant={setEditingVariant}
              onDeleteVariant={setConfirmDeleteVariant}
            />
          </div>
          <div className="hidden lg:block">
            <ProductsTable
              parents={parents}
              orphans={orphans}
              globalFilter={filter}
              onEditParent={setEditingParent}
              onDeleteParent={setConfirmDeleteTree}
              onEditVariant={setEditingVariant}
              onDeleteVariant={setConfirmDeleteVariant}
            />
          </div>
        </>
      )}

      {/* Crear producto padre + variantes */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>
              Selecciona base, colores, tallas y estampados para crear todas las variantes en bloque.
            </DialogDescription>
          </DialogHeader>
          <ProductForm onSuccess={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Editar padre */}
      <Dialog open={!!editingParent} onOpenChange={(o) => !o && setEditingParent(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar producto padre</DialogTitle>
            <DialogDescription>{editingParent?.name}</DialogDescription>
          </DialogHeader>
          {editingParent && (
            <ProductForm product={editingParent} onSuccess={() => setEditingParent(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Editar variante */}
      <VariantEditDialog
        variant={editingVariant}
        open={!!editingVariant}
        onOpenChange={(o) => !o && setEditingVariant(null)}
      />

      {/* Confirmar borrar variante */}
      <AlertDialog
        open={!!confirmDeleteVariant}
        onOpenChange={(o) => !o && setConfirmDeleteVariant(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar variante</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{confirmDeleteVariant?.name}</strong> ({confirmDeleteVariant?.sku}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVariant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar borrar padre + todas variantes */}
      <AlertDialog
        open={!!confirmDeleteTree}
        onOpenChange={(o) => !o && setConfirmDeleteTree(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto y variantes</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{confirmDeleteTree?.name}</strong> y todas sus{" "}
              <strong>{confirmDeleteTree?.children.length ?? 0} variantes</strong>. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTree}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar todo
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
