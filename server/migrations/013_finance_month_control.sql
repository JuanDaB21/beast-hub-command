-- =========================================================
-- FINANCE: fecha editable del movimiento + método de pago
-- =========================================================
-- occurred_at: fecha real en que ocurrió el movimiento (editable,
-- backdateable). created_at se conserva como timestamp de auditoría.
-- payment_method: canal de pago del ingreso (nullable; solo ingresos).

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_transactions_payment_method_check'
      AND conrelid = 'financial_transactions'::regclass
  ) THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT financial_transactions_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN
        ('fisico','nequi','daviplata','bancolombia','cod'));
  END IF;
END $$;

-- Backfill de filas existentes: la fecha del movimiento = fecha de registro.
UPDATE financial_transactions SET occurred_at = created_at
WHERE occurred_at IS DISTINCT FROM created_at;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_occurred_at
  ON financial_transactions (occurred_at DESC);
