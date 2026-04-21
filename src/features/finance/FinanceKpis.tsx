import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Wallet, ListOrdered } from "lucide-react";
import type { FinancialTransaction } from "./api";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function FinanceKpis({ transactions }: { transactions: FinancialTransaction[] }) {
  const income = transactions
    .filter((t) => t.transaction_type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const items = [
    { label: "Ingresos", value: fmt(income), icon: TrendingUp, color: "text-emerald-600" },
    { label: "Gastos", value: fmt(expense), icon: TrendingDown, color: "text-red-600" },
    {
      label: "Balance neto",
      value: fmt(balance),
      icon: Wallet,
      color: balance >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: "Movimientos",
      value: String(transactions.length),
      icon: ListOrdered,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">{it.label}</p>
              <p className={`text-xl font-semibold ${it.color}`}>{it.value}</p>
            </div>
            <it.icon className={`h-8 w-8 ${it.color} opacity-60`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
