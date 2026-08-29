-- =========================================================
-- BOM role marker: distinguish base garment / ink / process
-- rows inside product_materials so the base can be edited safely.
-- =========================================================
ALTER TABLE product_materials
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'base';

-- Backfill: mark ink rows (raw material matches the product's print design ink).
UPDATE product_materials pm
   SET role = 'ink'
  FROM products p
  JOIN print_designs d ON d.id = p.print_design_id
 WHERE pm.product_id = p.id
   AND pm.raw_material_id = d.ink_raw_material_id
   AND pm.role <> 'ink';

CREATE INDEX IF NOT EXISTS idx_product_materials_role ON product_materials(role);
