

## Plan: Cliente asume costo de envío en pedidos manuales

### Objetivo
Permitir marcar al crear un pedido manual que **el cliente asume el costo de envío**. Esos pedidos no requieren capturar costo de envío al despachar y no descuentan margen en la lógica de ingresos.

### Cambio de schema (migración)

Añadir a `orders`:
- `customer_pays_shipping boolean NOT NULL DEFAULT false`.

Backfill = `false` para pedidos existentes (mantiene comportamiento actual: el negocio asume el envío).

### Cambios en API

**`src/features/orders/api.ts`:**
- Extender `Order` y `OrderWithItems` con `customer_pays_shipping: boolean`.
- Extender `NewOrderInput` con `customer_pays_shipping: boolean`.
- `useCreateManualOrder()` envía el flag al insertar.

**`src/features/logistics/api.ts`:**
- Extender `ShipmentOrder` con `customer_pays_shipping: boolean`.
- `useMarkShipped` / `useUpdateShippingCost`: si `customer_pays_shipping = true`, forzar `shipping_cost = 0` al guardar (defensa en profundidad).

**`src/features/bi/api.ts` — `useBiData`:**
- Traer `customer_pays_shipping` en el select de orders.
- Al acumular `shippingCost`, sumar 0 cuando `customer_pays_shipping = true`.
- Mismo tratamiento en `monthlyClosure`.

### Cambios en UI

**`src/features/orders/NewOrderForm.tsx`:**
- Nuevo `Switch` debajo del de COD: *"El cliente asume el costo de envío"* con texto auxiliar *"No se sumará como gasto al despachar."*.
- Estado `customerPaysShipping`. Pasarlo al mutation.

**`src/features/logistics/ShipDialog.tsx`:**
- Si `order.customer_pays_shipping === true`:
  - Ocultar el input de costo de envío y mostrar leyenda *"El cliente asume el envío"*.
  - No exigir el campo; enviar `shipping_cost = 0`.
- En el resumen del diálogo, mostrar *"Envío pagado por el cliente"* en lugar del costo.

**`src/features/orders/OrderDetails.tsx`:**
- Cuando `customer_pays_shipping = true`: mostrar línea/badge *"Envío a cargo del cliente"* y omitir el descuento del envío en el margen visual.

**`src/features/logistics/FulfillmentBoard.tsx`:**
- En la tarjeta, mostrar etiqueta *"Cliente paga envío"* cuando aplique; no mostrar costo de envío.

**Dashboard (`src/pages/Index.tsx`) y `MonthlyClosureTable.tsx`:**
- Sin cambios visuales; los KPIs de "Costos de envío" y margen reflejan el cambio automáticamente vía `useBiData`.

### Archivos

**Migración nueva:** añade `customer_pays_shipping boolean NOT NULL DEFAULT false` a `orders`.

**Modificados:**
- `src/features/orders/api.ts`
- `src/features/orders/NewOrderForm.tsx`
- `src/features/orders/OrderDetails.tsx`
- `src/features/logistics/api.ts`
- `src/features/logistics/ShipDialog.tsx`
- `src/features/logistics/FulfillmentBoard.tsx`
- `src/features/bi/api.ts`

### Resultado
Al crear un pedido manual, el operador puede marcar que el cliente asume el envío. Esos pedidos saltan la captura del costo de envío al despachar y no se contabilizan como gasto en el dashboard ni en el cierre mensual. Pedidos sin el flag mantienen el flujo actual.

