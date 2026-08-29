-- =========================================================
-- Print designs redesign: Drive link (DTF file) + parent/color
-- children hierarchy. Same artwork, multiple colors as children.
-- =========================================================

-- Link to the DTF print file on Google Drive.
ALTER TABLE print_designs
  ADD COLUMN IF NOT EXISTS drive_url TEXT;

-- Parent design → color children (self reference). NULL = top-level.
ALTER TABLE print_designs
  ADD COLUMN IF NOT EXISTS parent_design_id UUID
    REFERENCES print_designs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_print_designs_parent ON print_designs(parent_design_id);

-- Relax the global UNIQUE(name): two color children may share a base name.
ALTER TABLE print_designs
  DROP CONSTRAINT IF EXISTS print_designs_name_key;
