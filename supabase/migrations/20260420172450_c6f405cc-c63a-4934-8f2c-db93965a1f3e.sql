
-- Drop permissive public policies and replace with authenticated-only
DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY[
    'suppliers','raw_materials','categories','subcategories','colors','sizes',
    'orders','order_items','products','product_materials',
    'work_orders','work_order_items','returns',
    'supply_requests','supply_request_items','supply_alerts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop all existing policies on the table
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    -- Create authenticated-only policy
    EXECUTE format(
      'CREATE POLICY "auth_all_%I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- Harden complete_work_order: reject anon callers
CREATE OR REPLACE FUNCTION public.complete_work_order(_work_order_id uuid)
 RETURNS work_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wo public.work_orders;
  item RECORD;
  recipe RECORD;
  consume_qty NUMERIC;
  current_rm_stock NUMERIC;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO wo FROM public.work_orders WHERE id = _work_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order % not found', _work_order_id;
  END IF;

  IF wo.status = 'completed' THEN
    RAISE EXCEPTION 'Work order already completed';
  END IF;

  IF wo.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot complete a cancelled work order';
  END IF;

  FOR item IN
    SELECT product_id, quantity_to_produce
    FROM public.work_order_items
    WHERE work_order_id = _work_order_id
  LOOP
    FOR recipe IN
      SELECT raw_material_id, quantity_required
      FROM public.product_materials
      WHERE product_id = item.product_id
    LOOP
      consume_qty := recipe.quantity_required * item.quantity_to_produce;
      SELECT stock INTO current_rm_stock FROM public.raw_materials WHERE id = recipe.raw_material_id FOR UPDATE;
      IF current_rm_stock IS NULL THEN
        RAISE EXCEPTION 'Raw material % not found', recipe.raw_material_id;
      END IF;
      IF current_rm_stock < consume_qty THEN
        RAISE EXCEPTION 'Insufficient raw material % (need %, have %)', recipe.raw_material_id, consume_qty, current_rm_stock;
      END IF;
    END LOOP;
  END LOOP;

  FOR item IN
    SELECT product_id, quantity_to_produce
    FROM public.work_order_items
    WHERE work_order_id = _work_order_id
  LOOP
    UPDATE public.products
    SET stock = stock + item.quantity_to_produce,
        updated_at = now()
    WHERE id = item.product_id;

    FOR recipe IN
      SELECT raw_material_id, quantity_required
      FROM public.product_materials
      WHERE product_id = item.product_id
    LOOP
      consume_qty := recipe.quantity_required * item.quantity_to_produce;
      UPDATE public.raw_materials
      SET stock = stock - consume_qty,
          updated_at = now()
      WHERE id = recipe.raw_material_id;
    END LOOP;
  END LOOP;

  UPDATE public.work_orders
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = _work_order_id
  RETURNING * INTO wo;

  RETURN wo;
END;
$function$;
