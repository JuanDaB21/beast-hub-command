-- =========================================================
-- RETURNS
-- =========================================================
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  reason_category TEXT NOT NULL,
  notes TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  company_assumes_shipping BOOLEAN NOT NULL DEFAULT false,
  return_shipping_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_returns_order_id ON returns(order_id);
CREATE INDEX idx_returns_product_id ON returns(product_id);
CREATE INDEX idx_returns_status ON returns(resolution_status);

CREATE OR REPLACE FUNCTION validate_return()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.resolution_status NOT IN ('pending', 'restocked', 'scrapped') THEN
    RAISE EXCEPTION 'resolution_status inválido: %', NEW.resolution_status;
  END IF;
  IF NEW.reason_category NOT IN ('Textil', 'Estampado', 'Logística', 'Inconformidad') THEN
    RAISE EXCEPTION 'reason_category inválido: %', NEW.reason_category;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_return
  BEFORE INSERT OR UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION validate_return();

CREATE TRIGGER trg_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- GLOBAL CONFIGS (printing/ironing + financial rates)
-- =========================================================
CREATE TABLE global_configs (
  id TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_global_configs_updated_at
  BEFORE UPDATE ON global_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO global_configs (id, value) VALUES
  ('printing_cost_per_meter', 45000),
  ('ironing_cost', 1500),
  ('shopify_fee_percent', 2.0),
  ('gateway_fee_percent', 3.0),
  ('gateway_fee_fixed', 900),
  ('cod_transport_fee_percent', 5.0),
  ('estimated_iva_percent', 19.0),
  ('estimated_retention_percent', 2.5)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- FINANCIAL TRANSACTIONS (unified ledger)
-- =========================================================
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_transactions_created_at
  ON financial_transactions (created_at DESC);
CREATE INDEX idx_financial_transactions_reference
  ON financial_transactions (reference_type, reference_id);
