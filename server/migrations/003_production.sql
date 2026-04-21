-- =========================================================
-- PRODUCT MATERIALS (BOM)
-- =========================================================
CREATE TABLE product_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity_required NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_required > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, raw_material_id)
);

CREATE INDEX idx_product_materials_product ON product_materials(product_id);
CREATE INDEX idx_product_materials_raw_material ON product_materials(raw_material_id);

-- =========================================================
-- WORK ORDERS
-- =========================================================
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT UNIQUE NOT NULL,
  status work_order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  target_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- WORK ORDER ITEMS
-- =========================================================
CREATE TABLE work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_to_produce INTEGER NOT NULL CHECK (quantity_to_produce > 0),
  is_dtf_added BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_order_items_wo ON work_order_items(work_order_id);
CREATE INDEX idx_work_order_items_product ON work_order_items(product_id);

-- =========================================================
-- complete_work_order(): atomic consume raw materials + add products
-- =========================================================
CREATE OR REPLACE FUNCTION complete_work_order(_work_order_id UUID)
RETURNS work_orders
LANGUAGE plpgsql
AS $$
DECLARE
  wo work_orders;
  item RECORD;
  recipe RECORD;
  consume_qty NUMERIC;
  current_rm_stock NUMERIC;
BEGIN
  SELECT * INTO wo FROM work_orders WHERE id = _work_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order % not found', _work_order_id;
  END IF;

  IF wo.status = 'completed' THEN
    RAISE EXCEPTION 'Work order already completed';
  END IF;

  IF wo.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot complete a cancelled work order';
  END IF;

  -- Validate stock availability before consuming anything
  FOR item IN
    SELECT product_id, quantity_to_produce
    FROM work_order_items
    WHERE work_order_id = _work_order_id
  LOOP
    FOR recipe IN
      SELECT raw_material_id, quantity_required
      FROM product_materials
      WHERE product_id = item.product_id
    LOOP
      consume_qty := recipe.quantity_required * item.quantity_to_produce;
      SELECT stock INTO current_rm_stock FROM raw_materials WHERE id = recipe.raw_material_id FOR UPDATE;
      IF current_rm_stock IS NULL THEN
        RAISE EXCEPTION 'Raw material % not found', recipe.raw_material_id;
      END IF;
      IF current_rm_stock < consume_qty THEN
        RAISE EXCEPTION 'Insufficient raw material % (need %, have %)', recipe.raw_material_id, consume_qty, current_rm_stock;
      END IF;
    END LOOP;
  END LOOP;

  -- Apply: add to product stock + deduct from raw material stock
  FOR item IN
    SELECT product_id, quantity_to_produce
    FROM work_order_items
    WHERE work_order_id = _work_order_id
  LOOP
    UPDATE products
    SET stock = stock + item.quantity_to_produce,
        updated_at = now()
    WHERE id = item.product_id;

    FOR recipe IN
      SELECT raw_material_id, quantity_required
      FROM product_materials
      WHERE product_id = item.product_id
    LOOP
      consume_qty := recipe.quantity_required * item.quantity_to_produce;
      UPDATE raw_materials
      SET stock = stock - consume_qty,
          updated_at = now()
      WHERE id = recipe.raw_material_id;
    END LOOP;
  END LOOP;

  UPDATE work_orders
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = _work_order_id
  RETURNING * INTO wo;

  RETURN wo;
END;
$$;
