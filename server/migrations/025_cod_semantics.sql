-- 025_cod_semantics.sql
--
-- El módulo COD se fusionó dentro de Logística. Dos cambios de fondo:
--
--   1. Entregado implica recaudado. Si la transportadora entregó, cobró, así que
--      cod_confirmed pasa a significar "el dinero ya está en manos de la
--      transportadora" (una cuenta por cobrar), no "el dinero ya entró a la
--      empresa". El contraste contra los giros reales se hace en Finanzas,
--      comparando estos totales contra los ingresos con payment_method='cod'.
--      Lo escribe PATCH /api/orders/:id al pasar a 'delivered'.
--
--   2. order_confirmed se conserva tal cual: es la llamada de confirmación
--      previa al despacho de los COD de Shopify (anti-pedido-falso), y su guard
--      sigue en POST /api/cod/orders/:id/confirm.
--
-- Estas 8 columnas nunca tuvieron documentación en el esquema; se agrega aquí
-- porque su semántica ya no es evidente desde el nombre.

COMMENT ON COLUMN orders.is_cod IS
  'Pedido contra-entrega. Se fija al crear (gateway de Shopify o alta manual) y no cambia.';
COMMENT ON COLUMN orders.order_confirmed IS
  'Hito 1: el cliente confirmó por teléfono/WhatsApp que sí quiere el pedido. Solo se exige a los COD de Shopify, antes de despachar.';
COMMENT ON COLUMN orders.order_confirmed_at IS
  'Momento del hito 1. Lo escribe POST /api/cod/orders/:id/confirm.';
COMMENT ON COLUMN orders.confirmed_by_staff_id IS
  'Staff que hizo la llamada de confirmación del hito 1.';
COMMENT ON COLUMN orders.cod_confirmed IS
  'Hito 2: la transportadora entregó y por tanto cobró. El dinero está en sus manos, aún no necesariamente en la empresa. Derivado de status=delivered, no editable por el cliente.';
COMMENT ON COLUMN orders.cod_received_at IS
  'Momento del hito 2 (igual a la fecha de entrega). Base de la conciliación COD del mes en Finanzas.';
COMMENT ON COLUMN orders.received_by_staff_id IS
  'Staff que marcó la entrega que disparó el hito 2.';
COMMENT ON COLUMN orders.carrier IS
  'Columna sin uso: la operación trabaja con una sola transportadora (Inter Rapidísimo) y nada la escribe.';

-- Alinea lo histórico con la regla nueva: todo COD ya entregado se considera
-- cobrado por la transportadora, fechado con su propia fecha de entrega.
UPDATE orders
   SET cod_confirmed = true,
       cod_received_at = COALESCE(cod_received_at, delivered_at, updated_at)
 WHERE is_cod
   AND status = 'delivered'
   AND NOT cod_confirmed;
