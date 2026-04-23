import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StaffPanel } from "@/features/config/StaffPanel";
import { CommissionsPanel } from "@/features/config/CommissionsPanel";
import { TaxesPanel } from "@/features/config/TaxesPanel";
import { PrintingConfigPanel } from "@/features/production/PrintingConfigPanel";
import { ShopifyPanel } from "@/features/config/ShopifyPanel";

export default function Config() {
  return (
    <AppShell
      title="Configuración"
      description="Centro de configuración general del sistema."
    >
      <Tabs defaultValue="staff" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="staff">Usuarios</TabsTrigger>
          <TabsTrigger value="production">Costos de Producción</TabsTrigger>
          <TabsTrigger value="commissions">Comisiones y Pasarelas</TabsTrigger>
          <TabsTrigger value="taxes">Proyección de Impuestos</TabsTrigger>
          <TabsTrigger value="shopify">Shopify</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <StaffPanel />
        </TabsContent>
        <TabsContent value="production">
          <PrintingConfigPanel />
        </TabsContent>
        <TabsContent value="commissions">
          <CommissionsPanel />
        </TabsContent>
        <TabsContent value="taxes">
          <TaxesPanel />
        </TabsContent>
        <TabsContent value="shopify">
          <ShopifyPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
