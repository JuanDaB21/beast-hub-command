-- =========================================================
-- 019_supply_reception.sql
-- Recepción por ítem: el empleado marca lo que realmente llegó y cada marca
-- carga el delta al inventario, en vez de un único botón que cargaba de golpe
-- todo lo que el proveedor había confirmado.
-- =========================================================

ALTER TABLE supply_request_items
  ADD COLUMN IF NOT EXISTS quantity_received NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_by_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Las solicitudes ya entregadas cargaron su stock con la función vieja: se marca
-- lo confirmado como recibido para que la nueva lógica no vuelva a cargarlo.
UPDATE supply_request_items i
   SET quantity_received = i.quantity_confirmed
  FROM supply_requests r
 WHERE r.id = i.supply_request_id
   AND r.status = 'delivered'
   AND i.quantity_received = 0;

-- Nuevo estado intermedio: el proveedor ya confirmó (partial/confirmed) y el
-- equipo empezó a recibir, pero todavía falta mercancía por llegar.
ALTER TABLE supply_requests DROP CONSTRAINT IF EXISTS supply_requests_status_check;
ALTER TABLE supply_requests
  ADD CONSTRAINT supply_requests_status_check
  CHECK (status IN ('pending','partial','confirmed','receiving','delivered'));

-- =========================================================
-- complete_supply_request(): ahora carga SOLO el remanente pendiente.
-- Idempotente: correrla dos veces no duplica stock.
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

  FOR item IN
    SELECT id, raw_material_id, (quantity_confirmed - quantity_received) AS pending
    FROM supply_request_items
    WHERE supply_request_id = _request_id
      AND is_available = true
      AND quantity_confirmed > quantity_received
  LOOP
    UPDATE raw_materials
    SET stock = stock + item.pending,
        updated_at = now()
    WHERE id = item.raw_material_id;

    UPDATE supply_request_items
    SET quantity_received = quantity_confirmed,
        received_at = now()
    WHERE id = item.id;
  END LOOP;

  UPDATE supply_requests
  SET status = 'delivered',
      updated_at = now()
  WHERE id = _request_id;
END;
$$;
