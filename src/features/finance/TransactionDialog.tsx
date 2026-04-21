import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
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

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      if (transaction) {
        setAmount(String(transaction.amount));
        // If existing category isn't in the list, still set it (Select will show as-is)
        setCategory(transaction.category);
        setDescription(transaction.description ?? "");
      } else {
        setAmount("");
        setCategory(categories[0]);
        setDescription("");
      }
    }
  }, [open, mode, transaction]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = create.isPending || update.isPending;

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!category) {
      toast.error("Selecciona una categoría.");
      return;
    }
    try {
      if (isEdit && transaction) {
        await update.mutateAsync({
          id: transaction.id,
          reference_type: transaction.reference_type,
          amount: amt,
          category,
          description: description.trim() || null,
        });
        toast.success("Transacción actualizada");
      } else {
        await create.mutateAsync({
          transaction_type: mode,
          amount: amt,
          category,
          description: description.trim() || null,
          reference_type: "manual",
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
          <div className="space-y-2">
            <Label>Monto (COP)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
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
