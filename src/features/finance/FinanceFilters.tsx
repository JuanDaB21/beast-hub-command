import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceFilters as F,
} from "./api";

interface Props {
  filters: F;
  onChange: (f: F) => void;
  onReset: () => void;
  onAddIncome: () => void;
  onAddExpense: () => void;
  extraCategories?: string[];
}

const ALL_CATS = Array.from(
  new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]),
);

export function FinanceFilters({
  filters,
  onChange,
  onReset,
  onAddIncome,
  onAddExpense,
  extraCategories = [],
}: Props) {
  const [from, setFrom] = useState<Date | undefined>(
    filters.from ? new Date(filters.from) : undefined,
  );
  const [to, setTo] = useState<Date | undefined>(filters.to ? new Date(filters.to) : undefined);

  const categories = Array.from(new Set([...ALL_CATS, ...extraCategories])).sort();

  const update = (patch: Partial<F>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 md:grid-cols-12">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={filters.type ?? "all"}
            onValueChange={(v) => update({ type: v as F["type"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Ingreso</SelectItem>
              <SelectItem value="expense">Gasto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-3 space-y-1">
          <Label className="text-xs">Categoría</Label>
          <Select
            value={filters.category ?? "all"}
            onValueChange={(v) => update({ category: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Desde</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !from && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {from ? format(from, "dd MMM yyyy", { locale: es }) : "—"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={from}
                onSelect={(d) => {
                  setFrom(d);
                  update({ from: d ? d.toISOString() : null });
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !to && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {to ? format(to, "dd MMM yyyy", { locale: es }) : "—"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={to}
                onSelect={(d) => {
                  // Set to end of day
                  const end = d ? new Date(d.setHours(23, 59, 59, 999)) : undefined;
                  setTo(end);
                  update({ to: end ? end.toISOString() : null });
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="md:col-span-3 space-y-1">
          <Label className="text-xs">Buscar descripción</Label>
          <Input
            value={filters.search ?? ""}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Texto libre..."
          />
        </div>

        <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="mr-1 h-4 w-4" /> Limpiar filtros
          </Button>
          <div className="flex gap-2">
            <Button onClick={onAddIncome}>
              <Plus className="mr-1 h-4 w-4" /> Registrar Ingreso
            </Button>
            <Button variant="destructive" onClick={onAddExpense}>
              <Plus className="mr-1 h-4 w-4" /> Registrar Gasto
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
