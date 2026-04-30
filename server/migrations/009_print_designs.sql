-- =========================================================
-- PRINT DESIGNS catalog
-- =========================================================
CREATE TABLE print_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hex_code TEXT NOT NULL DEFAULT '#000000',
  ink_raw_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
  ink_grams_per_cm NUMERIC(8,3) NOT NULL DEFAULT 0.5,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_print_designs_active ON print_designs(active);

CREATE TRIGGER trg_print_designs_updated BEFORE UPDATE ON print_designs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FK from products to catalog (SET NULL preserves legacy rows)
ALTER TABLE products
  ADD COLUMN print_design_id UUID REFERENCES print_designs(id) ON DELETE SET NULL;

CREATE INDEX idx_products_print_design_id ON products(print_design_id);
