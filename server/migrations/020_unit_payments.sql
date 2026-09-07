-- =========================================================
-- 020_unit_payments.sql
-- Pago a empleados operativos por prenda vendida. La base de cálculo son los
-- pedidos EFECTIVAMENTE entregados, así que hace falta una fecha de entrega
-- real: hasta ahora solo existía created_at.
-- =========================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at);

-- Backfill: los pedidos ya entregados usan su última modificación como
-- aproximación de la fecha de entrega.
UPDATE orders SET delivered_at = updated_at
 WHERE status = 'delivered' AND delivered_at IS NULL;

CREATE OR REPLACE FUNCTION set_delivered_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    NEW.delivered_at = COALESCE(NEW.delivered_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_delivered_at ON orders;
CREATE TRIGGER trg_orders_delivered_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_delivered_at();

-- =========================================================
-- Historial de pagos por unidad vendida.
-- El valor por unidad varía de pago a pago, por eso se guarda en la fila junto
-- con el conteo de unidades del periodo (snapshot al momento de generar).
-- =========================================================
CREATE TABLE IF NOT EXISTS unit_payment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from TIMESTAMPTZ NOT NULL,
  period_to TIMESTAMPTZ NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  rate_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  financial_transaction_id UUID,
  created_by_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unit_payment_runs_period_check CHECK (period_to > period_from)
);

CREATE INDEX IF NOT EXISTS idx_unit_payment_runs_period ON unit_payment_runs(period_to DESC);

DROP TRIGGER IF EXISTS trg_unit_payment_runs_updated_at ON unit_payment_runs;
CREATE TRIGGER trg_unit_payment_runs_updated_at
  BEFORE UPDATE ON unit_payment_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
