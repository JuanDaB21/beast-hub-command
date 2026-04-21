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
  type FinancialTransactionType,
} from "./api";

interface Props {
  mode: FinancialTransactionType;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TransactionDialog({ mode, open, onOpenChange }: Props) {
  const isIncome = mode === "income";
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const create = useCreateTransaction();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setCategory(categories[0]);
      setDescription("");
    }
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la transacción.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isIncome ? "Registrar Ingreso" : "Registrar Gasto"}
          </DialogTitle>
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
                {categories.map((c) => (
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
            disabled={create.isPending}
            variant={isIncome ? "default" : "destructive"}
          >
            {create.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
