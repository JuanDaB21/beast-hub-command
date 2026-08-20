-- ===========================================================================
-- Undo del sync por API accidental (pedidos Shopify sin nombre de cliente)
-- ---------------------------------------------------------------------------
-- Contexto: se sincronizaron TODOS los pedidos de Shopify por API por error.
-- Discriminador: el sync por API (sin scope de "protected customer data") no
-- trae el nombre del cliente, así que TODOS esos pedidos quedaron como
-- customer_name = 'Cliente Shopify'. Los imports por CSV traen el Billing Name
-- y los pedidos manuales tienen nombre real → NO se ven afectados.
--
-- order_items y returns caen por ON DELETE CASCADE. El sync NO crea
-- transacciones financieras, así que finanzas no se afecta. NO se restaura
-- stock (BH sigue reflejando lo que Shopify ya descontó).
--
-- Ejecutar en la consola de Postgres de Railway (o `railway connect`).
-- ===========================================================================

-- 1) Revisar el conteo ANTES de borrar:
SELECT count(*) AS a_borrar
FROM orders
WHERE source = 'shopify'
  AND customer_name = 'Cliente Shopify';

-- 2) Revisar una muestra para confirmar que son los correctos:
SELECT order_number, created_at, status, customer_name, customer_phone
FROM orders
WHERE source = 'shopify'
  AND customer_name = 'Cliente Shopify'
ORDER BY created_at DESC
LIMIT 50;

-- 3) Si el conteo y la muestra cuadran, borrar en transacción.
--    Ejecutar el bloque, revisar "DELETE N" y luego COMMIT (o ROLLBACK).
BEGIN;

DELETE FROM orders
WHERE source = 'shopify'
  AND customer_name = 'Cliente Shopify';

-- Si el número de filas borradas coincide con lo esperado:
COMMIT;
-- Si algo no cuadra, en lugar del COMMIT anterior ejecutar:
-- ROLLBACK;
