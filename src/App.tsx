import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
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
import Cod from "./pages/Cod.tsx";
import Config from "./pages/Config.tsx";
import Finance from "./pages/Finance.tsx";
import Auth from "./pages/Auth.tsx";

const queryClient = new QueryClient();

const protect = (el: JSX.Element) => <ProtectedRoute>{el}</ProtectedRoute>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Públicas */}
            <Route path="/supplier/:token" element={<SupplierPortal />} />
            <Route path="/auth" element={<Auth />} />

            {/* Admin protegido */}
            <Route path="/" element={protect(<Index />)} />
            <Route path="/sourcing" element={protect(<Sourcing />)} />
            <Route path="/inventario" element={protect(<Inventory />)} />
            <Route path="/ordenes" element={protect(<Orders />)} />
            <Route path="/produccion" element={protect(<Production />)} />
            <Route path="/logistica" element={protect(<Logistics />)} />
            <Route path="/devoluciones" element={protect(<Returns />)} />
            <Route path="/solicitudes" element={protect(<SupplyRequests />)} />
            <Route path="/almacen" element={protect(<ModulePlaceholder slug="almacen" />)} />
            <Route path="/alertas" element={protect(<ModulePlaceholder slug="alertas" />)} />
            <Route path="/cod" element={protect(<Cod />)} />
            <Route path="/finanzas" element={protect(<Finance />)} />
            <Route path="/analitica" element={protect(<Index />)} />
            <Route path="/config" element={protect(<Config />)} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
