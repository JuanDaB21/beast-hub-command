import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { useRawMaterials, useSuppliers } from "@/features/sourcing/api";
import { SupplierForm } from "@/features/sourcing/SupplierForm";
import { RawMaterialForm } from "@/features/sourcing/RawMaterialForm";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityDetailCard } from "@/components/shared/EntityDetailCard";
import { MaterialGroupCard, groupMaterials } from "@/features/sourcing/MaterialGroupCard";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default function Sourcing() {
  const [tab, setTab] = useState("suppliers");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);

  const { data: suppliers, isLoading: loadingSuppliers } = useSuppliers();
  const { data: materials, isLoading: loadingMaterials } = useRawMaterials();

  const supplierUsage = useMemo(() => {
    const map = new Map<string, number>();
    (materials ?? []).forEach((m) => map.set(m.supplier_id, (map.get(m.supplier_id) ?? 0) + 1));
    return map;
  }, [materials]);

  const headerActions = (
    <Dialog
      open={tab === "suppliers" ? supplierOpen : materialOpen}
      onOpenChange={tab === "suppliers" ? setSupplierOpen : setMaterialOpen}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">
            {tab === "suppliers" ? "Nuevo proveedor" : "Nueva base"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {tab === "suppliers" ? "Crear proveedor" : "Registrar base"}
          </DialogTitle>
          <DialogDescription>
            {tab === "suppliers"
              ? "Datos de contacto del proveedor."
              : "Catalogación normalizada de la base."}
          </DialogDescription>
        </DialogHeader>
        {tab === "suppliers" ? (
          <SupplierForm onSuccess={() => setSupplierOpen(false)} />
        ) : (
          <RawMaterialForm onSuccess={() => setMaterialOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <AppShell
      title="Módulo 3 · Proveedores y Bases"
      description="Administrador de proveedores y gestión de bases."
      actions={headerActions}
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="suppliers">Proveedores ({suppliers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="materials">Bases ({materials?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* ------- SUPPLIERS ------- */}
        <TabsContent value="suppliers" className="space-y-3">
          {loadingSuppliers ? (
            <SkeletonGrid />
          ) : !suppliers?.length ? (
            <EmptyState
              title="Sin proveedores aún"
              hint="Crea tu primer proveedor para empezar a registrar bases."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suppliers.map((s) => (
                <EntityDetailCard
                  key={s.id}
                  title={s.name}
                  subtitle={s.active ? undefined : "Inactivo"}
                  detailsTitle={s.name}
                  detailsDescription="Detalles del proveedor"
                  summary={
                    <div className="space-y-2">
                      <div className="text-foreground">{s.contact_phone}</div>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          tone={s.active ? "green" : "neutral"}
                          label={s.active ? "Activo" : "Inactivo"}
                        />
                        <span className="text-xs text-muted-foreground">
                          {supplierUsage.get(s.id) ?? 0} base(s)
                        </span>
                      </div>
                    </div>
                  }
                  details={
                    <div className="space-y-3 text-sm">
                      <DetailRow label="Teléfono" value={s.contact_phone} />
                      <DetailRow label="Email" value={s.contact_email ?? "—"} />
                      <DetailRow label="Dirección" value={s.address ?? "—"} />
                      <DetailRow label="Notas" value={s.notes ?? "—"} />
                      <DetailRow
                        label="Bases asociadas"
                        value={String(supplierUsage.get(s.id) ?? 0)}
                      />
                      <div className="pt-2">
                        <WhatsAppContactButton
                          phone={s.contact_phone}
                          message={`Hola ${s.name}, te contacto desde Beast Club.`}
                        />
                      </div>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------- RAW MATERIALS ------- */}
        <TabsContent value="materials" className="space-y-3">
          {loadingMaterials ? (
            <SkeletonGrid />
          ) : !materials?.length ? (
            <EmptyState
              title="Sin bases aún"
              hint="Registra tu primera base asociándola a un proveedor."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {materials.map((m) => {
                const lowStock = m.stock <= 0;
                return (
                  <EntityDetailCard
                    key={m.id}
                    title={m.name}
                    subtitle={m.sku ?? undefined}
                    detailsTitle={m.name}
                    detailsDescription={m.supplier?.name ?? "Sin proveedor"}
                    summary={
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {m.category && (
                            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                              {m.category.name}
                            </span>
                          )}
                          {m.subcategory && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                              {m.subcategory.name}
                            </span>
                          )}
                          {m.color && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                              {m.color.hex_code && (
                                <span
                                  className="h-2 w-2 rounded-full border"
                                  style={{ backgroundColor: m.color.hex_code }}
                                />
                              )}
                              {m.color.name}
                            </span>
                          )}
                          {m.size && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                              {m.size.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {currency(Number(m.unit_price))}/{m.unit_of_measure}
                          </span>
                          <StatusBadge
                            tone={lowStock ? "red" : "green"}
                            label={`Stock: ${m.stock}`}
                          />
                        </div>
                      </div>
                    }
                    details={
                      <div className="space-y-3 text-sm">
                        <DetailRow label="Proveedor" value={m.supplier?.name ?? "—"} />
                        <DetailRow label="Categoría" value={m.category?.name ?? "—"} />
                        <DetailRow label="Subcategoría" value={m.subcategory?.name ?? "—"} />
                        <DetailRow label="Color" value={m.color?.name ?? "—"} />
                        <DetailRow label="Talla" value={m.size?.label ?? "—"} />
                        <DetailRow label="SKU" value={m.sku ?? "—"} />
                        <DetailRow
                          label="Precio"
                          value={`${currency(Number(m.unit_price))} / ${m.unit_of_measure}`}
                        />
                        <DetailRow label="Stock" value={String(m.stock)} />
                        {m.supplier?.contact_phone && (
                          <div className="pt-2">
                            <WhatsAppContactButton
                              phone={m.supplier.contact_phone}
                              message={`Hola ${m.supplier.name}, consulta sobre ${m.name}.`}
                            />
                          </div>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}
