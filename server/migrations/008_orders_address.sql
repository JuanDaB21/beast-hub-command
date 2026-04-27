-- 008_orders_address.sql
-- Captura de dirección + ciudad (DANE) en pedidos manuales.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city_dane_code TEXT NULL;
