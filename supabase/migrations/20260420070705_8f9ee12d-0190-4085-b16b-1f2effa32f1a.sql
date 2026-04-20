-- 1) orders: hacer order_number y customer_name NOT NULL (rellenando huérfanos primero)
UPDATE public.orders
SET order_number = 'ORD-' || to_char(created_at, 'YYYYMMDD') || '-' || substr(id::text, 1, 8)
WHERE order_number IS NULL;

UPDATE public.orders
SET customer_name = 'Sin nombre'
WHERE customer_name IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN order_number SET NOT NULL,
  ALTER COLUMN customer_name SET NOT NULL;

-- 2) order_items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_order_items" ON public.order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_order_items" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_order_items" ON public.order_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_order_items" ON public.order_items
  FOR DELETE TO authenticated USING (true);

-- 3) Trigger: recálculo automático del total del pedido
CREATE OR REPLACE FUNCTION public.recalc_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  oid UUID;
BEGIN
  oid := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE public.orders
  SET total = COALESCE((
    SELECT SUM(quantity * unit_price) FROM public.order_items WHERE order_id = oid
  ), 0),
      updated_at = now()
  WHERE id = oid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_order_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_order_total();