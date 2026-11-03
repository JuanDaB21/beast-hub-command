import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

/** Control segmentado claro / oscuro / sistema. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme = "system", setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn("inline-flex rounded-md bg-muted p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium transition-colors duration-fast",
              active ? "bg-brand text-brand-foreground" : "opacity-70 hover:opacity-100",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
