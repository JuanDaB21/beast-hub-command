-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.order_source AS ENUM ('shopify', 'manual');
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.work_order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.alert_issue_type AS ENUM ('low_stock', 'price_change', 'quality', 'delay', 'other');
CREATE TYPE public.alert_severity AS ENUM ('low', 'medium', 'high');

-- =========================================================
-- TRIGGER FN: updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- CATÁLOGOS
-- =========================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

CREATE TABLE public.colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hex_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- CORE
-- =========================================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  color_id UUID REFERENCES public.colors(id) ON DELETE SET NULL,
  size_id UUID REFERENCES public.sizes(id) ON DELETE SET NULL,
  sku TEXT,
  name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'unit',
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_raw_materials_supplier ON public.raw_materials(supplier_id);
CREATE INDEX idx_raw_materials_category ON public.raw_materials(category_id);
CREATE TRIGGER trg_raw_materials_updated BEFORE UPDATE ON public.raw_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  safety_stock INTEGER NOT NULL DEFAULT 0,
  aging_days INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  source public.order_source NOT NULL DEFAULT 'manual',
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  status public.order_status NOT NULL DEFAULT 'pending',
  is_cod BOOLEAN NOT NULL DEFAULT false,
  cod_confirmed BOOLEAN NOT NULL DEFAULT false,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,
  status public.work_order_status NOT NULL DEFAULT 'pending',
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_orders_batch ON public.work_orders(batch_id);
CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.supply_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  issue_type public.alert_issue_type NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'medium',
  message TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_supply_alerts_unresolved ON public.supply_alerts(resolved) WHERE resolved = false;

-- =========================================================
-- RLS: enable + policies (authenticated full access)
-- =========================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'categories','subcategories','colors','sizes',
    'suppliers','raw_materials','products','orders','work_orders','supply_alerts'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY "auth_select_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (true);$p$, t);
    EXECUTE format($p$CREATE POLICY "auth_insert_%1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (true);$p$, t);
    EXECUTE format($p$CREATE POLICY "auth_update_%1$s" ON public.%1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);$p$, t);
    EXECUTE format($p$CREATE POLICY "auth_delete_%1$s" ON public.%1$I FOR DELETE TO authenticated USING (true);$p$, t);
  END LOOP;
END $$;

-- =========================================================
-- SEED CATÁLOGOS (respetando FKs)
-- =========================================================
INSERT INTO public.categories (name) VALUES
  ('Telas'), ('Avíos'), ('Empaque');

INSERT INTO public.subcategories (category_id, name)
SELECT c.id, s.name FROM public.categories c
JOIN (VALUES
  ('Telas','Algodón'),
  ('Telas','Poliéster'),
  ('Telas','Mezcla'),
  ('Avíos','Hilos'),
  ('Avíos','Botones'),
  ('Avíos','Cierres'),
  ('Empaque','Bolsas'),
  ('Empaque','Etiquetas')
) AS s(category, name) ON s.category = c.name;

INSERT INTO public.colors (name, hex_code) VALUES
  ('Negro','#000000'),
  ('Blanco','#FFFFFF'),
  ('Rojo','#DC2626'),
  ('Azul','#2563EB'),
  ('Verde','#16A34A'),
  ('Gris','#6B7280');

INSERT INTO public.sizes (label, sort_order) VALUES
  ('XS',1),('S',2),('M',3),('L',4),('XL',5),('XXL',6);