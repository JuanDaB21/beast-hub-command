import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { MOBILE_PRIMARY, NAV_SECTIONS, isModuleActive, moduleBySlug, type ModuleDef } from "@/lib/modules";
import { useAuth } from "@/features/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "./ThemeSwitcher";

const primary = MOBILE_PRIMARY.map(moduleBySlug).filter((m): m is ModuleDef => Boolean(m));

/** Navegación inferior para < md: 4 accesos fijos + "Más" en un drawer. */
export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = !primary.some((m) => isModuleActive(m, pathname));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur-md md:hidden"
      >
        <ul className="grid h-[var(--bottom-nav-h)] grid-cols-5">
          {primary.map((m) => (
            <li key={m.slug}>
              <NavItem to={m.path} label={m.short} icon={m.icon} active={isModuleActive(m, pathname)} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(navItemClass, inMore && activeClass)}
              aria-haspopup="dialog"
            >
              <Menu className="h-5 w-5" />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[85svh]">
          <DrawerTitle className="sr-only">Todos los módulos</DrawerTitle>
          <div className="overflow-y-auto px-4 pb-safe">
            {NAV_SECTIONS.map((section, idx) => {
              const items = section.slugs.map(moduleBySlug).filter((m): m is ModuleDef => Boolean(m));
              return (
                <section key={section.label ?? idx} className="py-2">
                  {section.label && <h2 className="px-1 pb-1 text-xs font-medium text-muted-foreground">{section.label}</h2>}
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((m) => {
                      const active = isModuleActive(m, pathname);
                      return (
                        <Link
                          key={m.slug}
                          to={m.path}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-lg bg-surface-2 p-2 text-center text-xs font-medium transition-colors duration-fast",
                            active ? "bg-brand-soft text-brand-ink" : "text-foreground active:bg-accent",
                          )}
                        >
                          <m.icon className="h-5 w-5" />
                          <span className="leading-tight">{m.short}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <div className="mt-2 space-y-3 border-t py-4">
              <ThemeSwitcher className="w-full" />
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium">{user?.name || user?.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-danger-ink active:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" />
                  Salir
                </button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

const navItemClass =
  "relative flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors duration-fast active:text-foreground";
const activeClass =
  "text-foreground before:absolute before:inset-x-5 before:top-0 before:h-[3px] before:rounded-b-full before:bg-brand";

function NavItem({ to, label, icon: Icon, active }: { to: string; label: string; icon: ModuleDef["icon"]; active: boolean }) {
  return (
    <Link to={to} aria-current={active ? "page" : undefined} className={cn(navItemClass, active && activeClass)}>
      <Icon className="h-5 w-5" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
