import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface OverflowItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Acción destructiva: va al final, separada y en rojo. */
  destructive?: boolean;
}

/** Menú "⋯" para acciones secundarias de una página o fila. */
export function OverflowMenu({ items, label = "Más acciones" }: { items: OverflowItem[]; label?: string }) {
  const regular = items.filter((i) => !i.destructive);
  const danger = items.filter((i) => i.destructive);
  const render = (i: OverflowItem) => (
    <DropdownMenuItem
      key={i.label}
      disabled={i.disabled}
      onSelect={i.onSelect}
      className={cn("h-10 gap-2", i.destructive && "text-danger-ink focus:bg-danger-soft focus:text-danger-ink")}
    >
      {i.icon && <i.icon className="h-4 w-4" />}
      {i.label}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} title={label}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        {regular.map(render)}
        {regular.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map(render)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
