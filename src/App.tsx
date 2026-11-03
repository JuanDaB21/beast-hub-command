import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
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
import Config from "./pages/Config.tsx";
import Finance from "./pages/Finance.tsx";
import Auth from "./pages/Auth.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <Sonner position="top-center" richColors closeButton />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Públicas */}
              <Route path="/supplier/:token" element={<SupplierPortal />} />
              <Route path="/auth" element={<Auth />} />

              {/* Admin protegido: un solo layout persistente */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
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
                <Route path="/finanzas" element={<Finance />} />
                <Route path="/analitica" element={<Index />} />
                <Route path="/config" element={<Config />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
