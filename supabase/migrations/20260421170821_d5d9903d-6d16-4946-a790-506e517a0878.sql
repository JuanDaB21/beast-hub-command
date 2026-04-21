
-- 1. Libro Mayor Unificado
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    amount NUMERIC NOT NULL,
    category TEXT NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_financial_transactions"
ON public.financial_transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at
  ON public.financial_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_reference
  ON public.financial_transactions (reference_type, reference_id);

-- 2. Campos financieros en returns
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS company_assumes_shipping BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_shipping_cost NUMERIC NOT NULL DEFAULT 0;

-- 3. Variables en global_configs
INSERT INTO public.global_configs (id, value) VALUES
  ('shopify_fee_percent', 2.0),
  ('gateway_fee_percent', 3.0),
  ('gateway_fee_fixed', 900),
  ('cod_transport_fee_percent', 5.0),
  ('estimated_iva_percent', 19.0),
  ('estimated_retention_percent', 2.5)
ON CONFLICT (id) DO NOTHING;
