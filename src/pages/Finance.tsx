import { useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnitPaymentsPanel } from "@/features/unit-payments/UnitPaymentsPanel";
import { FinanceFilters } from "@/features/finance/FinanceFilters";
import { FinanceLedgerTable } from "@/features/finance/FinanceLedgerTable";
import { TransactionDialog } from "@/features/finance/TransactionDialog";
import { MonthSelector } from "@/features/finance/MonthSelector";
import { FinanceGlobalKpis } from "@/features/finance/FinanceGlobalKpis";
import { FinanceKpiRow } from "@/features/finance/FinanceKpiRow";
import { TrendChart } from "@/features/finance/TrendChart";
import { ProfitabilityChart } from "@/features/finance/ProfitabilityChart";
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
  const isMobile = useIsMobile();

  const extraCategories = Array.from(new Set(transactions.map((t) => t.category)));

  const filtersPanel = (
    <FinanceFilters
      filters={filters}
      onChange={setFilters}
      onReset={() => setFilters(monthFilters(month))}
      onAddIncome={() => setDialogMode("income")}
      onAddExpense={() => setDialogMode("expense")}
      extraCategories={extraCategories}
    />
  );

  return (
    <AppShell
      title="Finanzas"
      description="Libro de ingresos y gastos del negocio."
      actions={
        <>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogMode("income")}>
            <Plus className="h-4 w-4" />
            Ingreso
          </Button>
          <Button size="sm" variant="brand" className="gap-1.5" onClick={() => setDialogMode("expense")}>
            <Minus className="h-4 w-4" />
            Gasto
          </Button>
        </>
      }
    >
      <Tabs defaultValue="ledger" className="space-y-5">
        <TabsList className="w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <TabsTrigger value="ledger">Libro</TabsTrigger>
          <TabsTrigger value="unit-payments">Pago por prenda</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-5">
          <MonthSelector month={month} onChange={handleMonthChange} />

          <FinanceKpiRow month={monthStr} />

          {isMobile ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="group w-full justify-between">
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros y búsqueda
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-base group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">{filtersPanel}</CollapsibleContent>
            </Collapsible>
          ) : (
            filtersPanel
          )}

          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Cargando transacciones...
              </CardContent>
            </Card>
          ) : (
            <FinanceLedgerTable transactions={transactions} />
          )}

          <TrendChart month={monthStr} months={6} />

          <ProfitabilityChart month={monthStr} months={6} />

          <ReconciliationChart month={monthStr} />

          <FinanceGlobalKpis />

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
