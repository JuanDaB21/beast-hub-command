-- 014_finance_source.sql
-- Canal de venta (origen) del ingreso, para conciliar contra las ventas por origen
-- de las órdenes (orders.source: 'shopify' | 'manual'). Nullable; solo aplica a ingresos.

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_transactions_source_check'
  ) THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT financial_transactions_source_check
      CHECK (source IS NULL OR source IN ('shopify', 'manual'));
  END IF;
END $$;
