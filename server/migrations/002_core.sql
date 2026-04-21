-- =========================================================
-- SUPPLIERS
-- =========================================================
CREATE TABLE suppliers (
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

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- RAW MATERIALS
-- =========================================================
CREATE TABLE raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
  size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
  sku TEXT,
  name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'unit',
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_raw_materials_supplier ON raw_materials(supplier_id);
CREATE INDEX idx_raw_materials_category ON raw_materials(category_id);

CREATE TRIGGER trg_raw_materials_updated BEFORE UPDATE ON raw_materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- PRODUCTS (consolidated final shape)
-- =========================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  safety_stock INTEGER NOT NULL DEFAULT 0,
  aging_days INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  product_url TEXT,
  base_color TEXT,
  print_color TEXT,
  size TEXT,
  print_height_cm NUMERIC NOT NULL DEFAULT 0,
  parent_id UUID,
  is_parent BOOLEAN NOT NULL DEFAULT false,
  print_design TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_parent_id ON products(parent_id);

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- ORDERS (consolidated final shape)
-- =========================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  source order_source NOT NULL DEFAULT 'manual',
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  is_cod BOOLEAN NOT NULL DEFAULT false,
  cod_confirmed BOOLEAN NOT NULL DEFAULT false,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delay_reason TEXT,
  cod_received_at TIMESTAMPTZ,
  received_by_staff_id UUID REFERENCES profiles(id),
  carrier TEXT,
  order_confirmed BOOLEAN NOT NULL DEFAULT false,
  order_confirmed_at TIMESTAMPTZ,
  confirmed_by_staff_id UUID REFERENCES profiles(id),
  payment_method TEXT,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  customer_pays_shipping BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- payment_method validation
CREATE OR REPLACE FUNCTION validate_order_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('fisico','nequi','daviplata','bancolombia') THEN
    RAISE EXCEPTION 'payment_method inválido: %', NEW.payment_method;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_order_payment_method_trg
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_payment_method();

-- =========================================================
-- ORDER ITEMS
-- =========================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Trigger: recompute order total on insert/update/delete
CREATE OR REPLACE FUNCTION recalc_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  oid UUID;
BEGIN
  oid := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE orders
  SET total = COALESCE((
    SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = oid
  ), 0),
      updated_at = now()
  WHERE id = oid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_order_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalc_order_total();
