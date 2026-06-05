-- 012_order_import_fields.sql
-- Importación CSV de órdenes Shopify: líneas de producto "desconocido" + fees,
-- y texto crudo de la pasarela de pago.

-- order_items: distinguir tipo de línea y preservar datos del CSV sin match.
--   kind='product'  → línea normal con product_id.
--   kind='unknown'  → producto del CSV no creado en el sistema (product_id NULL,
--                     external_name guarda el título original; asignable a mano).
--   kind='fee'      → línea virtual de cargo (comisión COD, envío prepago) sumada
--                     al total por el trigger recalc_order_total.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'product';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS external_name TEXT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS external_sku TEXT NULL;

-- Backfill: las líneas existentes sin product_id eran fees (comisión COD virtual)
-- o productos eliminados; ambas se mostraban como "Comisión COD transportadora".
-- Preservamos ese comportamiento etiquetándolas como fee.
UPDATE order_items
   SET kind = 'fee', external_name = 'Comisión COD transportadora'
 WHERE product_id IS NULL AND kind = 'product';

-- orders: texto crudo del Payment Method de Shopify (ej. "Cash on Delivery (COD)")
-- para mostrarlo prominente. payment_method sigue restringido al enum local.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopify_payment_gateway TEXT NULL;
