
CREATE OR REPLACE FUNCTION public.complete_supply_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req RECORD;
  item RECORD;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO req FROM public.supply_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply request % not found', _request_id;
  END IF;

  IF req.status = 'delivered' THEN
    RAISE EXCEPTION 'Supply request already delivered';
  END IF;

  FOR item IN
    SELECT raw_material_id, quantity_confirmed
    FROM public.supply_request_items
    WHERE supply_request_id = _request_id
      AND is_available = true
      AND quantity_confirmed > 0
  LOOP
    UPDATE public.raw_materials
    SET stock = stock + item.quantity_confirmed,
        updated_at = now()
    WHERE id = item.raw_material_id;
  END LOOP;

  UPDATE public.supply_requests
  SET status = 'delivered',
      updated_at = now()
  WHERE id = _request_id;
END;
$$;
