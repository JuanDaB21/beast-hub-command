-- =========================================================
-- FINANCIAL TRANSACTIONS: campo "cargado a" (responsable)
-- =========================================================

ALTER TABLE financial_transactions
  ADD COLUMN charged_to_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_financial_transactions_charged_to
  ON financial_transactions(charged_to_staff_id);
