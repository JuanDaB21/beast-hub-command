import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useStaff } from "@/features/staff/api";
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

  const { data: staff = [] } = useStaff();
  const chargedToOptions = [
    { value: "all", label: "Todos" },
    { value: "none", label: "Sin asignar" },
    ...staff
      .filter((s) => s.active)
      .map((s) => ({ value: s.id, label: s.full_name ?? s.email ?? s.id })),
  ];

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

        <div className="md:col-span-3 space-y-1">
          <Label className="text-xs">Cargado a</Label>
          <StandardCombobox
            value={filters.charged_to ?? "all"}
            onChange={(v) => update({ charged_to: v || "all" })}
            options={chargedToOptions}
            placeholder="Todos"
            searchPlaceholder="Buscar staff..."
          />
        </div>

        <div className="md:col-span-4">
          <DateRangePicker
            from={from}
            to={to}
            onChange={(r) => {
              setFrom(r.from);
              setTo(r.to);
              update({
                from: r.from ? r.from.toISOString() : null,
                to: r.to ? r.to.toISOString() : null,
              });
            }}
          />
        </div>

        <div className="md:col-span-12 space-y-1">
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
