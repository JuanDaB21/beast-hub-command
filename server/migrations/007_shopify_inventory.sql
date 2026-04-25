-- =========================================================
-- SHOPIFY INVENTORY (bidirectional sync, BH dominant)
-- =========================================================

-- Each Shopify variant has an inventory_item_id distinct from variant_id;
-- it is what /inventory_levels/set.json expects.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shopify_inventory_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_products_shopify_inventory_item
  ON products(shopify_inventory_item_id);

-- Single chosen location per store, plus inventory sync state.
ALTER TABLE shopify_config
  ADD COLUMN IF NOT EXISTS location_id            TEXT,
  ADD COLUMN IF NOT EXISTS location_name          TEXT,
  ADD COLUMN IF NOT EXISTS last_inventory_sync    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventory_sync_enabled BOOLEAN NOT NULL DEFAULT false;

-- Failure log for BH→Shopify pushes. Synchronous push writes here on error
-- without rolling back the originating BH transaction.
CREATE TABLE IF NOT EXISTS shopify_sync_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  operation     TEXT NOT NULL,
  error_message TEXT NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shopify_sync_errors_unresolved
  ON shopify_sync_errors(product_id) WHERE resolved_at IS NULL;
