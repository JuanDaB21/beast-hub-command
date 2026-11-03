import { useNavigate } from "react-router-dom";
import { Calculator, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_SECTIONS, moduleBySlug, type ModuleDef } from "@/lib/modules";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenQuote: () => void;
}

/** Paleta Ctrl/⌘+K: saltar a un módulo o ejecutar una acción global. */
export function CommandMenu({ open, onOpenChange, onOpenQuote }: CommandMenuProps) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Ir a módulo o acción…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        {NAV_SECTIONS.map((section, idx) => {
          const items = section.slugs.map(moduleBySlug).filter((m): m is ModuleDef => Boolean(m));
          return (
            <CommandGroup key={section.label ?? idx} heading={section.label ?? "Inicio"}>
              {items.map((m) => (
                <CommandItem key={m.slug} value={`${m.short} ${m.title}`} onSelect={() => run(() => navigate(m.path))}>
                  <m.icon className="mr-2 h-4 w-4" />
                  {m.short}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        <CommandSeparator />
        <CommandGroup heading="Acciones">
          <CommandItem onSelect={() => run(onOpenQuote)}>
            <Calculator className="mr-2 h-4 w-4" />
            Calculadora de cotización
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun className="mr-2 h-4 w-4" />
            Tema claro
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon className="mr-2 h-4 w-4" />
            Tema oscuro
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <Monitor className="mr-2 h-4 w-4" />
            Tema del sistema
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
