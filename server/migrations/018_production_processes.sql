-- =========================================================
-- Additional production processes (e.g. sleeve cutting):
-- a catalog with cost, assigned per product, and tracked as a
-- checklist step on each work order item.
-- =========================================================

-- Catalog of extra processes.
CREATE TABLE IF NOT EXISTS production_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_processes_active ON production_processes(active);

CREATE TRIGGER trg_production_processes_updated BEFORE UPDATE ON production_processes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Which processes a product/variant requires.
CREATE TABLE IF NOT EXISTS product_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES production_processes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, process_id)
);

CREATE INDEX IF NOT EXISTS idx_product_processes_product ON product_processes(product_id);

-- Tracked step on each work order item (checklist, like is_dtf_added).
CREATE TABLE IF NOT EXISTS work_order_item_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_item_id UUID NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES production_processes(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_item_id, process_id)
);

CREATE INDEX IF NOT EXISTS idx_woip_item ON work_order_item_processes(work_order_item_id);
