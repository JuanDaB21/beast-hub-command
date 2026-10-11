-- =========================================================
-- IMPORTACIÓN AUTOMÁTICA DE PEDIDOS SHOPIFY VÍA GMAIL
-- =========================================================
-- En plan Basic la API no entrega datos protegidos del cliente (nombre,
-- dirección, teléfono). La notificación al staff "Nuevo pedido" lleva un
-- bloque JSON oculto (docs/shopify/staff-order-notification.liquid) que el
-- servidor lee de Gmail (gmail.readonly) y pasa a syncOrders().

-- Log + dedupe por mensaje: con scope readonly no se puede marcar leído.
CREATE TABLE IF NOT EXISTS shopify_email_ingest (
  gmail_message_id TEXT PRIMARY KEY,
  shopify_order_id TEXT,
  order_name       TEXT,
  status           TEXT NOT NULL CHECK (status IN ('imported', 'skipped', 'error', 'no_payload')),
  error            TEXT,
  received_at      TIMESTAMPTZ,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_email_ingest_processed
  ON shopify_email_ingest(processed_at DESC);

ALTER TABLE shopify_config
  ADD COLUMN IF NOT EXISTS email_ingest_enabled    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_ingest_query      TEXT NOT NULL DEFAULT 'label:beasthub-pedidos newer_than:3d',
  ADD COLUMN IF NOT EXISTS last_email_ingest       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_ingest_error TEXT;
