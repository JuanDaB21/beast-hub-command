import { useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnitPaymentsPanel } from "@/features/unit-payments/UnitPaymentsPanel";
import { FinanceFilters } from "@/features/finance/FinanceFilters";
import { FinanceLedgerTable } from "@/features/finance/FinanceLedgerTable";
import { TransactionDialog } from "@/features/finance/TransactionDialog";
import { MonthSelector } from "@/features/finance/MonthSelector";
import { FinanceGlobalKpis } from "@/features/finance/FinanceGlobalKpis";
import { FinanceKpiRow } from "@/features/finance/FinanceKpiRow";
import { TrendChart } from "@/features/finance/TrendChart";
import { ReconciliationChart } from "@/features/finance/ReconciliationChart";
import {
  useFinancialTransactions,
  type FinanceFilters as F,
  type FinancialTransactionType,
} from "@/features/finance/api";

const monthFilters = (month: Date): F => ({
  type: "all",
  category: "all",
  charged_to: "all",
  from: startOfMonth(month).toISOString(),
  to: endOfMonth(month).toISOString(),
  search: "",
});

export default function Finance() {
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [filters, setFilters] = useState<F>(monthFilters(new Date()));
  const [dialogMode, setDialogMode] = useState<FinancialTransactionType | null>(null);

  const monthStr = format(month, "yyyy-MM");

  const handleMonthChange = (m: Date) => {
    setMonth(m);
    setFilters(monthFilters(m));
  };

  const { data: transactions = [], isLoading } = useFinancialTransactions(filters);

  const extraCategories = Array.from(new Set(transactions.map((t) => t.category)));

  return (
    <AppShell
      title="Libro Mayor · Finanzas"
      description="Registro unificado de ingresos y gastos del negocio."
    >
      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ledger">Libro</TabsTrigger>
          <TabsTrigger value="unit-payments">Pago prendas vendidas</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-4">
          <FinanceGlobalKpis />

          <MonthSelector month={month} onChange={handleMonthChange} />

          <FinanceKpiRow month={monthStr} />

          <TrendChart month={monthStr} months={6} />

          <ReconciliationChart month={monthStr} />

          <FinanceFilters
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(monthFilters(month))}
            onAddIncome={() => setDialogMode("income")}
            onAddExpense={() => setDialogMode("expense")}
            extraCategories={extraCategories}
          />

          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Cargando transacciones...
              </CardContent>
            </Card>
          ) : (
            <FinanceLedgerTable transactions={transactions} />
          )}

          <p className="text-xs text-muted-foreground">
            Los movimientos automáticos (RMA, mermas, fletes asumidos) se registran al
            resolverse en cada módulo. Los pagos a proveedores e ingresos extra-orden se
            capturan aquí.
          </p>
        </TabsContent>

        <TabsContent value="unit-payments">
          <UnitPaymentsPanel />
        </TabsContent>
      </Tabs>

      <TransactionDialog
        mode={dialogMode ?? "income"}
        open={dialogMode !== null}
        onOpenChange={(o) => !o && setDialogMode(null)}
      />
    </AppShell>
  );
}
