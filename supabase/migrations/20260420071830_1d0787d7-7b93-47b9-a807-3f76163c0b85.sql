DROP TABLE IF EXISTS public.work_orders CASCADE;

CREATE TABLE public.product_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity_required NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_required > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id, raw_material_id)
);

CREATE INDEX idx_product_materials_product ON public.product_materials(product_id);
CREATE INDEX idx_product_materials_raw_material ON public.product_materials(raw_material_id);

ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_product_materials" ON public.product_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_product_materials" ON public.product_materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_product_materials" ON public.product_materials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_product_materials" ON public.product_materials FOR DELETE TO authenticated USING (true);

CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT UNIQUE NOT NULL,
  status public.work_order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  target_date DATE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_work_orders" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_work_orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_work_orders" ON public.work_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_work_orders" ON public.work_orders FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_to_produce INTEGER NOT NULL CHECK (quantity_to_produce > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_order_items_wo ON public.work_order_items(work_order_id);
CREATE INDEX idx_work_order_items_product ON public.work_order_items(product_id);

ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_work_order_items" ON public.work_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_work_order_items" ON public.work_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_work_order_items" ON public.work_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_work_order_items" ON public.work_order_items FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.complete_work_order(_work_order_id UUID)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wo public.work_orders;
  item RECORD;
  recipe RECORD;
  consume_qty NUMERIC;
  current_rm_stock NUMERIC;
BEGIN
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
$$;