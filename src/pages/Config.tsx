import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StaffPanel } from "@/features/config/StaffPanel";
import { CommissionsPanel } from "@/features/config/CommissionsPanel";
import { TaxesPanel } from "@/features/config/TaxesPanel";
import { PrintingConfigPanel } from "@/features/production/PrintingConfigPanel";
import { ShopifyPanel } from "@/features/config/ShopifyPanel";
import { PrintDesignsTable } from "@/features/print-designs/PrintDesignsTable";
import { ProcessesTable } from "@/features/config/ProcessesTable";

const SECTIONS = [
  { value: "staff", label: "Usuarios" },
  { value: "production", label: "Costos de producción" },
  { value: "commissions", label: "Comisiones y pasarelas" },
  { value: "taxes", label: "Proyección de impuestos" },
  { value: "estampados", label: "Estampados" },
  { value: "procesos", label: "Procesos" },
  { value: "shopify", label: "Shopify" },
];

export default function Config() {
  const [section, setSection] = useState("staff");

  return (
    <AppShell title="Configuración" description="Ajustes generales del sistema.">
      <Tabs
        value={section}
        onValueChange={setSection}
        orientation="vertical"
        className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6"
      >
        {/* Móvil: selector de sección */}
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="mb-4 h-11 font-medium lg:hidden" aria-label="Sección">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="h-10">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Desktop: navegación lateral */}
        <TabsList className="sticky top-24 hidden h-auto w-full flex-col items-stretch gap-0.5 bg-transparent p-0 lg:flex">
          {SECTIONS.map((s) => (
            <TabsTrigger
              key={s.value}
              value={s.value}
              className="justify-start rounded-md px-3 py-2 text-left data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-border"
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0">
          <TabsContent value="staff" className="mt-0">
            <StaffPanel />
          </TabsContent>
          <TabsContent value="production" className="mt-0">
            <PrintingConfigPanel />
          </TabsContent>
          <TabsContent value="commissions" className="mt-0">
            <CommissionsPanel />
          </TabsContent>
          <TabsContent value="taxes" className="mt-0">
            <TaxesPanel />
          </TabsContent>
          <TabsContent value="estampados" className="mt-0">
            <PrintDesignsTable />
          </TabsContent>
          <TabsContent value="procesos" className="mt-0">
            <ProcessesTable />
          </TabsContent>
          <TabsContent value="shopify" className="mt-0">
            <ShopifyPanel />
          </TabsContent>
        </div>
      </Tabs>
    </AppShell>
  );
}
