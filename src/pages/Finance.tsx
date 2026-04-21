import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FinanceKpis } from "@/features/finance/FinanceKpis";
import { FinanceFilters } from "@/features/finance/FinanceFilters";
import { FinanceLedgerTable } from "@/features/finance/FinanceLedgerTable";
import { TransactionDialog } from "@/features/finance/TransactionDialog";
import {
  useFinancialTransactions,
  type FinanceFilters as F,
  type FinancialTransactionType,
} from "@/features/finance/api";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const defaultFilters = (): F => ({
  type: "all",
  category: "all",
  from: startOfMonth(new Date()).toISOString(),
  to: endOfMonth(new Date()).toISOString(),
  search: "",
});

export default function Finance() {
  const [filters, setFilters] = useState<F>(defaultFilters());
  const [dialogMode, setDialogMode] = useState<FinancialTransactionType | null>(null);

  const { data: transactions = [], isLoading } = useFinancialTransactions(filters);

  const byCategory = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      const cur = map.get(t.category) ?? { income: 0, expense: 0 };
      if (t.transaction_type === "income") cur.income += Number(t.amount);
      else cur.expense += Number(t.amount);
      map.set(t.category, cur);
    }
    const arr = Array.from(map.entries()).map(([category, v]) => ({
      category,
      ...v,
      total: v.income + v.expense,
    }));
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [transactions]);

  const maxCat = byCategory[0]?.total ?? 0;
  const extraCategories = byCategory.map((c) => c.category);

  return (
    <AppShell
      title="Libro Mayor · Finanzas"
      description="Registro unificado de ingresos y gastos del negocio."
    >
      <div className="space-y-4">
        <FinanceKpis transactions={transactions} />

        <FinanceFilters
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters())}
          onAddIncome={() => setDialogMode("income")}
          onAddExpense={() => setDialogMode("expense")}
          extraCategories={extraCategories}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isLoading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Cargando transacciones...
                </CardContent>
              </Card>
            ) : (
              <FinanceLedgerTable transactions={transactions} />
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen por categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {byCategory.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin movimientos en el periodo seleccionado.
                </p>
              )}
              {byCategory.map((c) => {
                const pct = maxCat > 0 ? (c.total / maxCat) * 100 : 0;
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmt(c.total)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      {c.income > 0 && (
                        <span className="text-emerald-600">+ {fmt(c.income)}</span>
                      )}
                      {c.expense > 0 && (
                        <span className="text-red-600">− {fmt(c.expense)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          Los movimientos automáticos (RMA, mermas, fletes asumidos) se registran al
          resolverse en cada módulo. Los pagos a proveedores e ingresos extra-orden se
          capturan aquí.
        </p>
      </div>

      <TransactionDialog
        mode={dialogMode ?? "income"}
        open={dialogMode !== null}
        onOpenChange={(o) => !o && setDialogMode(null)}
      />
    </AppShell>
  );
}
