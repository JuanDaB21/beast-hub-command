CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  reason_category TEXT NOT NULL,
  notes TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_returns_order_id ON public.returns(order_id);
CREATE INDEX idx_returns_product_id ON public.returns(product_id);
CREATE INDEX idx_returns_status ON public.returns(resolution_status);

-- Validación por trigger (no CHECK, para flexibilidad)
CREATE OR REPLACE FUNCTION public.validate_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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
BEFORE INSERT OR UPDATE ON public.returns
FOR EACH ROW EXECUTE FUNCTION public.validate_return();

CREATE TRIGGER trg_returns_updated_at
BEFORE UPDATE ON public.returns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_select_returns ON public.returns FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_returns ON public.returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_returns ON public.returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete_returns ON public.returns FOR DELETE TO authenticated USING (true);