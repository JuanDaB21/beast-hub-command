-- 024_backfill_payment_method.sql
--
-- La conciliación por vía de cobro (GET /api/finance/reconciliation) agrupa las
-- órdenes por el canal por el que entró la plata. Los pedidos importados de
-- Shopify nunca poblaron orders.payment_method: el INSERT de shopifyClient.ts no
-- incluye la columna y el botón "Verificar pago" solo marcaba payment_status.
--
-- A partir de ahora POST /api/orders/:id/verify-payment exige el método. Esto
-- rellena lo histórico infiriéndolo del texto crudo del gateway. Lo que no
-- matchee queda NULL y cae al bucket "Sin asignar" del gráfico, saldable a mano
-- desde el selector del detalle del pedido.
--
-- Solo toca prepagos de Shopify sin método: los COD se identifican con is_cod
-- (el trigger validate_order_payment_method no admite 'cod' en esta columna) y
-- los manuales ya eligen método al crearse.

UPDATE orders
   SET payment_method = 'nequi'
 WHERE source = 'shopify'
   AND payment_method IS NULL
   AND is_cod = false
   AND shopify_payment_gateway ~* 'nequi';

UPDATE orders
   SET payment_method = 'daviplata'
 WHERE source = 'shopify'
   AND payment_method IS NULL
   AND is_cod = false
   AND shopify_payment_gateway ~* 'daviplata';

-- Wompi y el resto de pasarelas giran a la cuenta Bancolombia.
UPDATE orders
   SET payment_method = 'bancolombia'
 WHERE source = 'shopify'
   AND payment_method IS NULL
   AND is_cod = false
   AND shopify_payment_gateway ~* '(wompi|bold|payu|mercado|epayco|card|tarjeta|credit|shopify_payments)';
