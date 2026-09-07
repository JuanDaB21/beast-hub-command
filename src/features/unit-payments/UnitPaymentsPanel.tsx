import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Loader2, Trash2, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { toast } from "sonner";
import {
  useCreateUnitPayment,
  useDeleteUnitPayment,
  useUnitPaymentRuns,
  useUnitsDetail,
  useUnitsInPeriod,
} from "./api";

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

const shortDate = (iso: string) => format(new Date(iso), "dd MMM yyyy", { locale: es });

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Pago a empleados operativos por prenda vendida. Cuenta unidades de pedidos ya
 * entregados en el rango y deja historial: el valor por unidad cambia de pago a
 * pago, así que se congela en cada solicitud generada.
 */
export function UnitPaymentsPanel() {
  const [from, setFrom] = useState<Date | undefined>(startOfMonth);
  const [to, setTo] = useState<Date | undefined>(endOfToday);
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: period, isLoading: loadingUnits } = useUnitsInPeriod(from, to);
  const { data: detail, isLoading: loadingDetail } = useUnitsDetail(from, to, showDetail);
  const { data: runs = [], isLoading: loadingRuns } = useUnitPaymentRuns();
  const create = useCreateUnitPayment();
  const remove = useDeleteUnitPayment();

  const units = period?.units ?? 0;
  const rateNum = Number(rate) || 0;
  const total = units * rateNum;
  const overlapping = period?.overlapping_runs ?? [];

  const historyTotal = useMemo(
    () => runs.reduce((s, r) => s + Number(r.total_amount), 0),
    [runs],
  );

  const generate = async (force = false) => {
    if (!from || !to) return;
    try {
      await create.mutateAsync({
        period_from: from.toISOString(),
        period_to: to.toISOString(),
        rate_per_unit: rateNum,
        notes: notes.trim() || null,
        force,
      });
      setRate("");
      setNotes("");
      toast.success("Solicitud de pago generada", {
        description: `${units} prendas · ${COP(total)} registrado como gasto de Nómina.`,
      });
    } catch (err) {
      toast.error("No se pudo generar el pago", { description: (err as Error).message });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
      toast.success("Pago eliminado", { description: "También se borró su gasto en el libro." });
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Generar pago por prendas vendidas
          </CardTitle>
          <CardDescription>
            Se cuentan las prendas de pedidos ya entregados dentro del rango.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <DateRangePicker
              from={from}
              to={to}
              onChange={(r) => {
                setFrom(r.from);
                setTo(r.to);
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="rate">
                  Valor por unidad (COP)
                </Label>
                <Input
                  id="rate"
                  type="number"
                  min={0}
                  step="100"
                  inputMode="numeric"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="Ej. 2000"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Prendas en el periodo</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                    disabled={units <= 0}
                    onClick={() => setShowDetail((v) => !v)}
                  >
                    {showDetail ? "Ocultar detalle" : "Ver detalle"}
                  </button>
                </div>
                <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 tabular-nums font-medium">
                  {loadingUnits ? <Skeleton className="h-4 w-10" /> : units.toLocaleString("es-CO")}
                </div>
              </div>
            </div>

            {/*
              Desglose pedido a pedido: el conteo va por FECHA DE ENTREGA, así que
              un pedido creado el mes anterior y entregado en este cuenta aquí.
              Sin este detalle, cualquier diferencia contra el listado de pedidos
              es una discusión sobre un total en vez de sobre pedidos concretos.
            */}
            {showDetail && (
              <div className="max-h-64 overflow-y-auto rounded-md border md:col-span-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead>Entregado</TableHead>
                      <TableHead className="text-right">Prendas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail ?? []).map((d) => {
                      const crossesMonth =
                        d.created_at.slice(0, 7) !== d.delivered_at.slice(0, 7);
                      return (
                        <TableRow key={d.order_number}>
                          <TableCell className="font-mono text-xs">{d.order_number}</TableCell>
                          <TableCell
                            className={`whitespace-nowrap text-xs ${
                              crossesMonth ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
                            }`}
                          >
                            {format(new Date(d.created_at), "d MMM yy", { locale: es })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(d.delivered_at), "d MMM yy", { locale: es })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{d.units}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {loadingDetail && (
                  <div className="p-3 text-center text-xs text-muted-foreground">Cargando...</div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor="run-notes">
              Notas (opcional)
            </Label>
            <Textarea
              id="run-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quincena, novedades, etc."
            />
          </div>

          {overlapping.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Periodo ya pagado parcialmente</AlertTitle>
              <AlertDescription>
                Hay {overlapping.length} pago(s) que se cruzan con este rango:{" "}
                {overlapping
                  .map((r) => `${shortDate(r.period_from)}–${shortDate(r.period_to)}`)
                  .join(", ")}
                . Generar aquí pagaría esas prendas dos veces, así que está bloqueado; ajusta
                las fechas o confírmalo de forma explícita.
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={create.isPending || units <= 0 || rateNum <= 0}
                  onClick={() => generate(true)}
                >
                  Generar de todos modos
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Total a pagar</span>
              <p className="text-xl font-semibold tabular-nums">{COP(total)}</p>
            </div>
            <Button onClick={() => generate()} disabled={create.isPending || units <= 0 || rateNum <= 0}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Generar solicitud de pago
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
          <CardDescription>
            {runs.length} pago(s) · {COP(historyTotal)} acumulado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRuns ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Prendas</TableHead>
                    <TableHead className="text-right">Valor/unidad</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Generado</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                        Todavía no has generado ningún pago.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">
                          {shortDate(r.period_from)} – {shortDate(r.period_to)}
                          {r.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{r.notes}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {COP(Number(r.rate_per_unit))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {COP(Number(r.total_amount))}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {shortDate(r.created_at)}
                          {r.created_by?.full_name ? ` · ${r.created_by.full_name}` : ""}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(r.id)}
                            aria-label="Eliminar pago"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
            <AlertDialogDescription>
              También se borrará el gasto de Nómina que generó en el libro de finanzas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
