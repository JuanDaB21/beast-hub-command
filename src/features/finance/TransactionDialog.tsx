import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStaff } from "@/features/staff/api";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_CHANNELS,
  useCreateTransaction,
  useUpdateTransaction,
  type FinancialTransaction,
  type FinancialTransactionType,
} from "./api";

interface Props {
  mode: FinancialTransactionType;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transaction?: FinancialTransaction | null;
}

export function TransactionDialog({ mode, open, onOpenChange, transaction }: Props) {
  const isEdit = !!transaction;
  const isIncome = mode === "income";
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const { data: staff = [] } = useStaff();

  const isManual = !transaction || !transaction.reference_type || transaction.reference_type === "manual";
  const accountingDisabled = isEdit && !isManual;

  const staffOptions = useMemo(
    () =>
      staff
        .filter((s) => s.active)
        .map((s) => ({ value: s.id, label: s.full_name ?? s.email ?? s.id })),
    [staff],
  );

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [chargedToId, setChargedToId] = useState<string | null>(null);
  const [occurred, setOccurred] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (transaction) {
        setAmount(String(transaction.amount));
        // If existing category isn't in the list, still set it (Select will show as-is)
        setCategory(transaction.category);
        setDescription(transaction.description ?? "");
        setChargedToId(transaction.charged_to_staff_id ?? null);
        setOccurred(new Date(transaction.occurred_at ?? transaction.created_at));
        setPaymentMethod(transaction.payment_method ?? null);
      } else {
        setAmount("");
        setCategory(categories[0]);
        setDescription("");
        setChargedToId(null);
        setOccurred(new Date());
        setPaymentMethod(null);
      }
    }
  }, [open, mode, transaction]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = create.isPending || update.isPending;

  const handleSubmit = async () => {
    try {
      if (isEdit && transaction) {
        if (isManual) {
          const amt = Number(amount);
          if (!amt || amt <= 0) {
            toast.error("Ingresa un monto válido mayor a 0.");
            return;
          }
          if (!category) {
            toast.error("Selecciona una categoría.");
            return;
          }
          await update.mutateAsync({
            id: transaction.id,
            reference_type: transaction.reference_type,
            amount: amt,
            category,
            description: description.trim() || null,
            charged_to_staff_id: chargedToId,
            occurred_at: occurred.toISOString(),
            payment_method: isIncome ? paymentMethod : null,
          });
        } else {
          await update.mutateAsync({
            id: transaction.id,
            reference_type: transaction.reference_type,
            charged_to_staff_id: chargedToId,
          });
        }
        toast.success("Transacción actualizada");
      } else {
        const amt = Number(amount);
        if (!amt || amt <= 0) {
          toast.error("Ingresa un monto válido mayor a 0.");
          return;
        }
        if (!category) {
          toast.error("Selecciona una categoría.");
          return;
        }
        await create.mutateAsync({
          transaction_type: mode,
          amount: amt,
          category,
          description: description.trim() || null,
          reference_type: "manual",
          charged_to_staff_id: chargedToId,
          occurred_at: occurred.toISOString(),
          payment_method: isIncome ? paymentMethod : null,
        });
        toast.success(
          `${isIncome ? "Ingreso" : "Gasto"} registrado por ${amt.toLocaleString("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
          })}`,
        );
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la transacción.");
    }
  };

  const title = isEdit
    ? isIncome
      ? "Editar Ingreso"
      : "Editar Gasto"
    : isIncome
      ? "Registrar Ingreso"
      : "Registrar Gasto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {accountingDisabled && (
            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              Esta transacción es automática. Solo puedes editar el campo "Cargado a"; el monto,
              categoría y descripción se gestionan desde su módulo de origen.
            </div>
          )}
          <div className="space-y-2">
            <Label>Monto (COP)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              disabled={accountingDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha del movimiento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal")}
                  disabled={accountingDisabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(occurred, "dd MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={occurred}
                  onSelect={(d) => d && setOccurred(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          {isIncome && (
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select
                value={paymentMethod ?? "none"}
                onValueChange={(v) => setPaymentMethod(v === "none" ? null : v)}
                disabled={accountingDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {PAYMENT_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory} disabled={accountingDisabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(categories.includes(category) ? categories : [category, ...categories]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle opcional del movimiento"
              rows={3}
              disabled={accountingDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Cargado a</Label>
            <StandardCombobox
              options={staffOptions}
              value={chargedToId}
              onChange={setChargedToId}
              placeholder="Sin asignar"
              searchPlaceholder="Buscar staff..."
              emptyText="No hay staff activo"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pending}
            variant={isIncome ? "default" : "destructive"}
          >
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
