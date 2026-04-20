import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Factory,
  Warehouse,
  AlertTriangle,
  PhoneCall,
  BarChart3,
  Settings,
  Send,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  id: number;
  slug: string;
  path: string;
  title: string;
  short: string;
  icon: LucideIcon;
}

export const MODULES: ModuleDef[] = [
  { id: 0, slug: "dashboard", path: "/", title: "Dashboard", short: "Inicio", icon: LayoutDashboard },
  { id: 1, slug: "inventario", path: "/inventario", title: "Módulo 1 · Inventario", short: "Inventario", icon: Package },
  { id: 2, slug: "ordenes", path: "/ordenes", title: "Módulo 2 · Órdenes", short: "Órdenes", icon: ShoppingCart },
  { id: 3, slug: "sourcing", path: "/sourcing", title: "Módulo 3 · Sourcing", short: "Sourcing", icon: Truck },
  { id: 4, slug: "produccion", path: "/produccion", title: "Módulo 4 · Producción", short: "Producción", icon: Factory },
  { id: 5, slug: "almacen", path: "/almacen", title: "Módulo 5 · Almacén", short: "Almacén", icon: Warehouse },
  { id: 6, slug: "solicitudes", path: "/solicitudes", title: "Solicitudes a Proveedor", short: "Solicitudes", icon: Send },
  { id: 7, slug: "alertas", path: "/alertas", title: "Módulo 7 · Alertas", short: "Alertas", icon: AlertTriangle },
  { id: 8, slug: "cod", path: "/cod", title: "Módulo 8 · COD", short: "COD", icon: PhoneCall },
  { id: 9, slug: "analitica", path: "/analitica", title: "Módulo 9 · Analítica", short: "Analítica", icon: BarChart3 },
  { id: 10, slug: "config", path: "/config", title: "Configuración", short: "Config", icon: Settings },
];
