import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Factory,
  Warehouse,
  AlertTriangle,
  PhoneCall,
  Settings,
  Send,
  Truck as TruckIcon,
  Undo2,
  Users,
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
  { id: 0, slug: "dashboard", path: "/", title: "Dashboard · BI & Finanzas", short: "Dashboard", icon: LayoutDashboard },
  { id: 1, slug: "inventario", path: "/inventario", title: "Módulo 1 · Inventario", short: "Inventario", icon: Package },
  { id: 2, slug: "ordenes", path: "/ordenes", title: "Módulo 2 · Órdenes", short: "Órdenes", icon: ShoppingCart },
  { id: 3, slug: "sourcing", path: "/sourcing", title: "Módulo 3 · Sourcing", short: "Proveedores e insumos", icon: Truck },
  { id: 4, slug: "produccion", path: "/produccion", title: "Módulo 4 · Producción", short: "Producción", icon: Factory },
  { id: 5, slug: "almacen", path: "/almacen", title: "Módulo 5 · Almacén", short: "Almacén", icon: Warehouse },
  { id: 11, slug: "logistica", path: "/logistica", title: "Módulo 6 · Logística", short: "Logística", icon: TruckIcon },
  { id: 12, slug: "devoluciones", path: "/devoluciones", title: "Módulo 7 · Devoluciones (RMA)", short: "Devoluciones", icon: Undo2 },
  { id: 6, slug: "solicitudes", path: "/solicitudes", title: "Solicitudes a Proveedor", short: "Solicitudes", icon: Send },
  { id: 7, slug: "alertas", path: "/alertas", title: "Módulo 7 · Alertas", short: "Alertas", icon: AlertTriangle },
  { id: 8, slug: "cod", path: "/cod", title: "Gestión COD · Recaudo", short: "COD", icon: PhoneCall },
  { id: 10, slug: "config", path: "/config", title: "Configuración · Staff", short: "Configuración", icon: Users },
];
