import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/shared/StatTile";
import { StatStrip } from "@/components/shared/StatStrip";
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
import { Archive, Plus, Search } from "lucide-react";
import {
  useDeleteProduct,
  useDeleteProductTree,
  useSetProductTreeActive,
  useProductTree,
  type Product,
  type ProductWithChildren,
} from "@/features/inventory/api";
import { ProductsTable } from "@/features/inventory/ProductsTable";
import { ProductsMobileList } from "@/features/inventory/ProductsMobileList";
import { matchesAllTokens } from "@/lib/textSearch";
import { ProductForm } from "@/features/inventory/ProductForm";
import { VariantEditDialog } from "@/features/inventory/VariantEditDialog";
import { MergeVariantDialog } from "@/features/inventory/MergeVariantDialog";
import { ProductProfitPanel } from "@/features/inventory/ProductProfitPanel";
import { AvailableVariantsList } from "@/features/inventory/AvailableVariantsList";
import { getStockStatus, isAgingFlagged } from "@/features/inventory/status";
import { toast } from "@/hooks/use-toast";

export default function Inventory() {
  const { parents, orphans, isLoading } = useProductTree();
  const delOne = useDeleteProduct();
  const delTree = useDeleteProductTree();
  const setTreeActive = useSetProductTreeActive();

  const [filter, setFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<Product | null>(null);
  const [profitParent, setProfitParent] = useState<ProductWithChildren | null>(null);
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState<Product | null>(null);
  const [mergeSource, setMergeSource] = useState<Product | null>(null);
  const [confirmDeleteTree, setConfirmDeleteTree] = useState<ProductWithChildren | null>(null);

  // KPIs sumando hijos + huérfanos (solo activos)
  const stats = useMemo(() => {
    const allItems: Product[] = [
      ...orphans.filter((o) => o.active),
      ...parents.filter((p) => p.active).flatMap((p) => p.children),
    ];
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

  const handleArchiveTree = async (p: ProductWithChildren) => {
    try {
      // En vista activa archiva (active=false); en vista de archivados restaura.
      await setTreeActive.mutateAsync({ parentId: p.id, active: showArchived });
      toast({ title: showArchived ? "Producto restaurado" : "Producto archivado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Vistas: activos (active !== false) vs archivados (active === false).
  const shownParents = parents.filter((p) => (showArchived ? !p.active : p.active));
  const shownOrphans = orphans.filter((o) => (showArchived ? !o.active : o.active));

  const headerActions = (
    <Button size="sm" variant="brand" className="gap-1.5" onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4" />
      Nuevo<span className="hidden sm:inline"> producto</span>
    </Button>
  );

  return (
    <AppShell
      title="Inventario"
      description="Productos con variantes de color, talla y estampado."
      actions={headerActions}
    >
      <Tabs defaultValue="productos" className="space-y-4">
        <TabsList className="w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="disponibles">Disponibles</TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="space-y-3">
          {/* KPIs */}
          <StatStrip cols={5}>
            <KPI label="Agotadas" value={stats.outOfStock} tone="red" />
            <KPI label="Stock crítico" value={stats.critical} tone="yellow" />
            <KPI label="En aging" value={stats.aging} tone="yellow" />
            <KPI label="Productos" value={stats.totalParents} />
            <KPI label="Variantes" value={stats.totalVariants} />
          </StatStrip>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="SKU o nombre"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={showArchived ? "default" : "outline"}
              className="shrink-0 gap-2"
              onClick={() => setShowArchived((v) => !v)}
              aria-pressed={showArchived}
            >
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">{showArchived ? "Ver activos" : "Ver archivados"}</span>
              <span className="sm:hidden">{showArchived ? "Activos" : "Archivo"}</span>
            </Button>
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
                  parents={shownParents.filter(
                    (p) =>
                      !filter ||
                      matchesAllTokens(
                        `${p.sku} ${p.name} ${p.children.map((c) => `${c.sku} ${c.name}`).join(" ")}`,
                        filter,
                      ),
                  )}
                  orphans={shownOrphans.filter(
                    (p) => !filter || matchesAllTokens(`${p.sku} ${p.name}`, filter),
                  )}
                  onEditParent={setEditingParent}
                  onDeleteParent={setConfirmDeleteTree}
                  onEditVariant={setEditingVariant}
                  onDeleteVariant={setConfirmDeleteVariant}
                  onMergeVariant={setMergeSource}
                  onShowProfit={setProfitParent}
                  onArchiveParent={handleArchiveTree}
                  archivedView={showArchived}
                />
              </div>
              <div className="hidden lg:block">
                <ProductsTable
                  parents={shownParents}
                  orphans={shownOrphans}
                  globalFilter={filter}
                  onEditParent={setEditingParent}
                  onDeleteParent={setConfirmDeleteTree}
                  onEditVariant={setEditingVariant}
                  onDeleteVariant={setConfirmDeleteVariant}
                  onMergeVariant={setMergeSource}
                  onShowProfit={setProfitParent}
                  onArchiveParent={handleArchiveTree}
                  archivedView={showArchived}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="disponibles">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <AvailableVariantsList parents={parents} orphans={orphans} />
          )}
        </TabsContent>
      </Tabs>

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
      <MergeVariantDialog
        source={mergeSource}
        open={!!mergeSource}
        onOpenChange={(o) => !o && setMergeSource(null)}
      />

      <VariantEditDialog
        variant={editingVariant}
        open={!!editingVariant}
        onOpenChange={(o) => !o && setEditingVariant(null)}
        onRequestDelete={(v) => {
          setEditingVariant(null);
          setConfirmDeleteVariant(v);
        }}
      />

      {/* Costo y rentabilidad por producto */}
      <ProductProfitPanel
        parent={profitParent}
        open={!!profitParent}
        onOpenChange={(o) => !o && setProfitParent(null)}
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
  return <StatTile label={label} value={String(value)} tone={value > 0 ? tone : undefined} size="compact" />;
}
