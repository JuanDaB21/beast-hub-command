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
  useDeleteTransaction,
  type FinancialTransaction,
} from "./api";
import { TransactionDialog } from "./TransactionDialog";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const originLabel = (ref: string | null) => {
  if (!ref || ref === "manual") return "Manual";
  if (ref === "return") return "Devolución";
  if (ref === "order") return "Pedido";
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
                    {format(new Date(t.created_at), "dd MMM yyyy · HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isIncome ? "default" : "destructive"}
                      className={isIncome ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                    >
                      {isIncome ? "Ingreso" : "Gasto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{t.category}</TableCell>
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
                      isIncome ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {isIncome ? "+" : "−"} {fmt(Number(t.amount))}
                  </TableCell>
                  <TableCell>
                    {isManual && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setTarget(t)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {transactions.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="text-right text-xs text-muted-foreground">
                  Totales del filtro
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">
                  <div className="text-emerald-600">+ {fmt(totalIncome)}</div>
                  <div className="text-red-600">− {fmt(totalExpense)}</div>
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
    </>
  );
}
