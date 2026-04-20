import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Sourcing from "./pages/Sourcing.tsx";
import Inventory from "./pages/Inventory.tsx";
import Orders from "./pages/Orders.tsx";
import Production from "./pages/Production.tsx";
import Logistics from "./pages/Logistics.tsx";
import Returns from "./pages/Returns.tsx";
import SupplyRequests from "./pages/SupplyRequests.tsx";
import SupplierPortal from "./pages/SupplierPortal.tsx";
import ModulePlaceholder from "./pages/ModulePlaceholder.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Portal público del proveedor (sin sidebar, sin auth) */}
          <Route path="/supplier/:token" element={<SupplierPortal />} />

          {/* Admin */}
          <Route path="/" element={<Index />} />
          <Route path="/sourcing" element={<Sourcing />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/ordenes" element={<Orders />} />
          <Route path="/produccion" element={<Production />} />
          <Route path="/logistica" element={<Logistics />} />
          <Route path="/devoluciones" element={<Returns />} />
          <Route path="/solicitudes" element={<SupplyRequests />} />
          <Route path="/almacen" element={<ModulePlaceholder slug="almacen" />} />
          <Route path="/alertas" element={<ModulePlaceholder slug="alertas" />} />
          <Route path="/cod" element={<ModulePlaceholder slug="cod" />} />
          <Route path="/analitica" element={<Index />} />
          <Route path="/config" element={<ModulePlaceholder slug="config" />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
