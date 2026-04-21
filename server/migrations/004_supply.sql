-- =========================================================
-- SUPPLY REQUESTS
-- =========================================================
CREATE TABLE supply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  secure_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supply_requests_status_check CHECK (status IN ('pending','partial','confirmed','delivered'))
);

CREATE INDEX idx_supply_requests_supplier ON supply_requests(supplier_id);
CREATE INDEX idx_supply_requests_token ON supply_requests(secure_token);

CREATE TRIGGER trg_supply_requests_updated_at
  BEFORE UPDATE ON supply_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- SUPPLY REQUEST ITEMS
-- =========================================================
CREATE TABLE supply_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_request_id UUID NOT NULL REFERENCES supply_requests(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity_requested NUMERIC NOT NULL DEFAULT 0,
  quantity_confirmed NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supply_request_items_req ON supply_request_items(supply_request_id);

-- =========================================================
-- complete_supply_request(): add confirmed quantities to raw stock
-- =========================================================
CREATE OR REPLACE FUNCTION complete_supply_request(_request_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  item RECORD;
BEGIN
  SELECT * INTO req FROM supply_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply request % not found', _request_id;
  END IF;

  IF req.status = 'delivered' THEN
    RAISE EXCEPTION 'Supply request already delivered';
  END IF;

  FOR item IN
    SELECT raw_material_id, quantity_confirmed
    FROM supply_request_items
    WHERE supply_request_id = _request_id
      AND is_available = true
      AND quantity_confirmed > 0
  LOOP
    UPDATE raw_materials
    SET stock = stock + item.quantity_confirmed,
        updated_at = now()
    WHERE id = item.raw_material_id;
  END LOOP;

  UPDATE supply_requests
  SET status = 'delivered',
      updated_at = now()
  WHERE id = _request_id;
END;
$$;

-- =========================================================
-- SUPPLY ALERTS
-- =========================================================
CREATE TABLE supply_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  issue_type alert_issue_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'medium',
  message TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supply_alerts_unresolved ON supply_alerts(resolved) WHERE resolved = false;
