import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type FinancialTransactionType = "income" | "expense";

export interface FinancialTransactionInput {
  transaction_type: FinancialTransactionType;
  amount: number;
  category: string;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinancialTransactionInput) => {
      const { error } = await supabase.from("financial_transactions").insert({
        transaction_type: input.transaction_type,
        amount: input.amount,
        category: input.category,
        reference_type: input.reference_type ?? null,
        reference_id: input.reference_id ?? null,
        description: input.description ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_transactions"] });
      qc.invalidateQueries({ queryKey: ["bi"] });
    },
  });
}

export async function insertTransaction(input: FinancialTransactionInput) {
  const { error } = await supabase.from("financial_transactions").insert({
    transaction_type: input.transaction_type,
    amount: input.amount,
    category: input.category,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    description: input.description ?? null,
  });
  if (error) throw error;
}
