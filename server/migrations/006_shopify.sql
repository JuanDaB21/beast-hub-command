-- =========================================================
-- SHOPIFY INTEGRATION
-- =========================================================

-- Traceability columns on products for bidirectional Shopify mapping
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shopify_product_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_products_shopify_product ON products(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_products_shopify_variant ON products(shopify_variant_id);

-- Deduplication on orders: prevents importing the same Shopify order twice
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shopify_order_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS shopify_order_number TEXT;

-- Shopify credentials and sync state (singleton row, id always = 1)
CREATE TABLE IF NOT EXISTS shopify_config (
  id                  INT PRIMARY KEY DEFAULT 1,
  store_domain        TEXT NOT NULL DEFAULT '',
  access_token        TEXT NOT NULL DEFAULT '',
  sync_enabled        BOOLEAN NOT NULL DEFAULT false,
  last_products_sync  TIMESTAMPTZ,
  last_orders_sync    TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shopify_config_singleton CHECK (id = 1)
);

INSERT INTO shopify_config DEFAULT VALUES ON CONFLICT DO NOTHING;
