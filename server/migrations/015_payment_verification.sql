-- Estado de pago para pedidos prepago (ortogonal a is_cod / COD).
-- 'paid'                 = pago confirmado (Wompi, o pedido manual).
-- 'pending_verification' = transferencia (Nequi u otra) aún sin verificar → NO
--                          es prepago todavía; requiere confirmación manual.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_by_staff_id UUID NULL REFERENCES profiles(id);

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('paid','pending_verification'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Financial Status crudo de Shopify (trazabilidad; por qué quedó por verificar).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopify_financial_status TEXT NULL;
