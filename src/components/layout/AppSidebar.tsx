import { useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_SECTIONS, isModuleActive, moduleBySlug, type ModuleDef } from "@/lib/modules";
import { useAuth } from "@/features/auth/AuthProvider";
import { BrandMark } from "./BrandMark";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center px-3 text-sidebar-accent-foreground">
        <BrandMark compact={collapsed} />
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {NAV_SECTIONS.map((section, idx) => {
          const items = section.slugs.map(moduleBySlug).filter((m): m is ModuleDef => Boolean(m));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={section.label ?? `group-${idx}`} className="py-1.5">
              {section.label && (
                <SidebarGroupLabel className="h-7 text-xs font-medium text-sidebar-foreground/60">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((m) => (
                    <SidebarMenuItem key={m.slug}>
                      <SidebarMenuButton
                        asChild
                        isActive={isModuleActive(m, pathname)}
                        tooltip={m.short}
                        className="relative h-9 data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary [&[data-active=true]>svg]:text-sidebar-primary"
                      >
                        <NavLink to={m.path} end={m.path === "/"}>
                          <m.icon />
                          <span>{m.short}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border p-3">
        {!collapsed && <ThemeSwitcher className="w-full bg-sidebar-accent text-sidebar-accent-foreground" />}
        <div className="flex items-center gap-2">
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {user?.name || user?.email}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">{user?.role}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground transition-colors duration-fast hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
