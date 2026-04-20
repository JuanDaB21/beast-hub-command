import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Sourcing from "./pages/Sourcing.tsx";
import Inventory from "./pages/Inventory.tsx";
import ModulePlaceholder from "./pages/ModulePlaceholder.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/sourcing" element={<Sourcing />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/ordenes" element={<ModulePlaceholder slug="ordenes" />} />
          <Route path="/produccion" element={<ModulePlaceholder slug="produccion" />} />
          <Route path="/almacen" element={<ModulePlaceholder slug="almacen" />} />
          <Route path="/alertas" element={<ModulePlaceholder slug="alertas" />} />
          <Route path="/cod" element={<ModulePlaceholder slug="cod" />} />
          <Route path="/analitica" element={<ModulePlaceholder slug="analitica" />} />
          <Route path="/config" element={<ModulePlaceholder slug="config" />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
