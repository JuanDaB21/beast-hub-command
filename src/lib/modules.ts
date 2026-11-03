import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Factory,
  Warehouse,
  AlertTriangle,
  Send,
  Truck as TruckIcon,
  Undo2,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  id: number;
  slug: string;
  path: string;
  title: string;
  short: string;
  icon: LucideIcon;
  /** Módulo aún sin implementar: fuera de la navegación principal. */
  placeholder?: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: 0, slug: "dashboard", path: "/", title: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
  { id: 1, slug: "inventario", path: "/inventario", title: "Inventario", short: "Inventario", icon: Package },
  { id: 2, slug: "ordenes", path: "/ordenes", title: "Órdenes", short: "Órdenes", icon: ShoppingCart },
  { id: 3, slug: "sourcing", path: "/sourcing", title: "Proveedores y bases", short: "Proveedores", icon: Truck },
  { id: 4, slug: "produccion", path: "/produccion", title: "Producción", short: "Producción", icon: Factory },
  { id: 5, slug: "almacen", path: "/almacen", title: "Almacén", short: "Almacén", icon: Warehouse, placeholder: true },
  { id: 11, slug: "logistica", path: "/logistica", title: "Logística", short: "Logística", icon: TruckIcon },
  { id: 12, slug: "devoluciones", path: "/devoluciones", title: "Devoluciones", short: "Devoluciones", icon: Undo2 },
  { id: 6, slug: "solicitudes", path: "/solicitudes", title: "Solicitudes a proveedor", short: "Solicitudes", icon: Send },
  { id: 7, slug: "alertas", path: "/alertas", title: "Alertas", short: "Alertas", icon: AlertTriangle, placeholder: true },
  { id: 13, slug: "finanzas", path: "/finanzas", title: "Finanzas", short: "Finanzas", icon: BookOpen },
  { id: 10, slug: "config", path: "/config", title: "Configuración", short: "Configuración", icon: Users },
];

export const moduleBySlug = (slug: string): ModuleDef | undefined =>
  MODULES.find((m) => m.slug === slug);

export const isModuleActive = (m: ModuleDef, pathname: string) =>
  m.path === "/" ? pathname === "/" : pathname.startsWith(m.path);

/** Agrupación de la navegación (sidebar, menú "Más" y paleta de comandos). */
export const NAV_SECTIONS: { label: string | null; slugs: string[] }[] = [
  { label: null, slugs: ["dashboard"] },
  { label: "Envíos", slugs: ["ordenes", "logistica", "inventario", "devoluciones"] },
  { label: "Lotes y producción", slugs: ["produccion", "solicitudes"] },
  { label: "Finanzas", slugs: ["finanzas"] },
  { label: "General", slugs: ["sourcing", "config"] },
];

/** Accesos fijos de la barra inferior en móvil; el resto va en "Más". */
export const MOBILE_PRIMARY = ["dashboard", "ordenes", "logistica", "inventario"];
