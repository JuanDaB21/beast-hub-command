-- =========================================================
-- FASE 9 — Shopify ↔ Bases + BOM bridge
-- =========================================================

-- Parent-level hint: which base group this Shopify-synced product belongs to.
-- Format: "{supplier_id}|{category_id}|{normalized(base_name)}"
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_group_key TEXT;
CREATE INDEX IF NOT EXISTS idx_products_base_group_key
  ON products(base_group_key) WHERE is_parent = true;

-- =========================================================
-- product_base_links: per-child resolution intent
-- =========================================================
CREATE TABLE product_base_links (
  product_id        UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id   UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  print_design_id   UUID REFERENCES print_designs(id) ON DELETE SET NULL,
  print_height_cm   NUMERIC(6,2) NOT NULL DEFAULT 0,
  link_source       TEXT NOT NULL CHECK (link_source IN ('auto','wizard','manual')),
  linked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by         UUID
);

CREATE INDEX idx_pbl_raw_material ON product_base_links(raw_material_id);
CREATE INDEX idx_pbl_print_design ON product_base_links(print_design_id);

-- =========================================================
-- Color / size aliases for fuzzy resolution
-- =========================================================
CREATE TABLE color_aliases (
  alias_norm TEXT PRIMARY KEY,
  color_id   UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_color_aliases_color ON color_aliases(color_id);

CREATE TABLE size_aliases (
  alias_norm TEXT PRIMARY KEY,
  size_id    UUID NOT NULL REFERENCES sizes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_size_aliases_size ON size_aliases(size_id);
