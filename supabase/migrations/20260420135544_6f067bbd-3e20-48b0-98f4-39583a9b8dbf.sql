-- Solicitudes a proveedor
CREATE TABLE public.supply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  secure_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT supply_requests_status_check CHECK (status IN ('pending','partial','confirmed','delivered'))
);

CREATE INDEX idx_supply_requests_supplier ON public.supply_requests(supplier_id);
CREATE INDEX idx_supply_requests_token ON public.supply_requests(secure_token);

CREATE TRIGGER trg_supply_requests_updated_at
BEFORE UPDATE ON public.supply_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.supply_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_select_supply_requests ON public.supply_requests
FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_supply_requests ON public.supply_requests
FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_supply_requests ON public.supply_requests
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete_supply_requests ON public.supply_requests
FOR DELETE TO authenticated USING (true);

-- Items de la solicitud
CREATE TABLE public.supply_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_request_id UUID NOT NULL REFERENCES public.supply_requests(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  quantity_requested NUMERIC NOT NULL DEFAULT 0,
  quantity_confirmed NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_supply_request_items_req ON public.supply_request_items(supply_request_id);

ALTER TABLE public.supply_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_select_supply_request_items ON public.supply_request_items
FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_supply_request_items ON public.supply_request_items
FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_supply_request_items ON public.supply_request_items
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete_supply_request_items ON public.supply_request_items
FOR DELETE TO authenticated USING (true);