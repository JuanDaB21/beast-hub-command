import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  PAYMENT_CHANNEL_LABEL,
  SALES_SOURCE_LABEL,
  useDeleteTransaction,
  type FinancialTransaction,
} from "./api";
import { TransactionDialog } from "./TransactionDialog";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const originLabel = (ref: string | null) => {
  if (!ref || ref === "manual") return "Manual";
  if (ref === "order") return "Pedido";
  if (ref === "unit_payment") return "Pago prendas";
  return ref;
};

const originVariant = (ref: string | null): "secondary" | "outline" =>
  !ref || ref === "manual" ? "secondary" : "outline";

export function FinanceLedgerTable({
  transactions,
}: {
  transactions: FinancialTransaction[];
}) {
  const [target, setTarget] = useState<FinancialTransaction | null>(null);
  const [editTarget, setEditTarget] = useState<FinancialTransaction | null>(null);
  const del = useDeleteTransaction();

  const totalIncome = transactions
    .filter((t) => t.transaction_type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const handleDelete = async () => {
    if (!target) return;
    try {
      await del.mutateAsync(target);
      toast.success("Transacción eliminada");
      setTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  };

  return (
    <>
      {/* Móvil: lista; tocar abre la edición */}
      <div className="md:hidden">
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay transacciones para los filtros seleccionados.
          </div>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {transactions.map((t) => {
                const isIncome = t.transaction_type === "income";
                const isManual = !t.reference_type || t.reference_type === "manual";
                return (
                  <li key={t.id} className="flex items-center gap-1 pr-1">
                    <button
                      type="button"
                      onClick={() => setEditTarget(t)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left active:bg-surface-2"
                    >
                      <span
                        aria-hidden
                        className={`h-9 w-1 shrink-0 rounded-full ${isIncome ? "bg-success" : "bg-danger"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.category}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {format(new Date(t.occurred_at ?? t.created_at), "dd MMM", { locale: es })}
                          {t.description ? `, ${t.description}` : ""}
                        </p>
                      </div>
                      <span
                        className={`tabular shrink-0 font-display text-lg font-semibold leading-none ${
                          isIncome ? "text-success-ink" : "text-danger-ink"
                        }`}
                      >
                        {isIncome ? "+" : "−"} {fmt(Number(t.amount))}
                      </span>
                    </button>
                    {isManual && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 shrink-0 text-muted-foreground"
                        onClick={() => setTarget(t)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex justify-end gap-4 px-1 text-sm font-semibold tabular-nums">
              <span className="text-success-ink">+ {fmt(totalIncome)}</span>
              <span className="text-danger-ink">− {fmt(totalExpense)}</span>
            </div>
          </>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Cargado a</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-[100px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No hay transacciones para los filtros seleccionados.
                </TableCell>
              </TableRow>
            )}
            {transactions.map((t) => {
              const isIncome = t.transaction_type === "income";
              const isManual = !t.reference_type || t.reference_type === "manual";
              return (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(t.occurred_at ?? t.created_at), "dd MMM yyyy", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isIncome ? "default" : "destructive"}
                      className={isIncome ? "bg-success hover:bg-success" : ""}
                    >
                      {isIncome ? "Ingreso" : "Gasto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{t.category}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.payment_method ? (PAYMENT_CHANNEL_LABEL[t.payment_method] ?? t.payment_method) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.source ? (SALES_SOURCE_LABEL[t.source] ?? t.source) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.charged_to?.full_name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {t.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={originVariant(t.reference_type)}>
                      {originLabel(t.reference_type)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${
                      isIncome ? "text-success-ink" : "text-danger-ink"
                    }`}
                  >
                    {isIncome ? "+" : "−"} {fmt(Number(t.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditTarget(t)}
                        aria-label="Editar"
                        title={isManual ? "Editar" : "Editar cargado a"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isManual && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setTarget(t)}
                          aria-label="Eliminar"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {transactions.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="text-right text-xs text-muted-foreground">
                  Totales del filtro
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">
                  <div className="text-success-ink">+ {fmt(totalIncome)}</div>
                  <div className="text-danger-ink">− {fmt(totalExpense)}</div>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar transacción?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Solo puedes eliminar transacciones
              registradas manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editTarget && (
        <TransactionDialog
          mode={editTarget.transaction_type}
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          transaction={editTarget}
        />
      )}
    </>
  );
}
