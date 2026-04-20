import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { MODULES, type ModuleDef } from "@/lib/modules";
import { Boxes } from "lucide-react";

const bySlug = (slug: string): ModuleDef | undefined =>
  MODULES.find((m) => m.slug === slug);

const SECTIONS: { label: string | null; slugs: string[] }[] = [
  { label: null, slugs: ["dashboard"] },
  {
    label: "Envíos",
    slugs: ["inventario", "ordenes", "logistica", "devoluciones", "cod"],
  },
  { label: "Lotes y producción", slugs: ["produccion", "solicitudes"] },
  { label: "General", slugs: ["sourcing", "config", "alertas"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Beast Club</span>
              <span className="text-xs text-muted-foreground">Command Center</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MODULES.map((m) => {
                const isActive = m.path === "/" ? pathname === "/" : pathname.startsWith(m.path);
                return (
                  <SidebarMenuItem key={m.slug}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={m.short}>
                      <NavLink
                        to={m.path}
                        end={m.path === "/"}
                        className="flex items-center gap-2"
                      >
                        <m.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{m.short}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
