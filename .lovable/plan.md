

## Plan: Costo de envío por pedido + impacto en rentabilidad

### Objetivo
Capturar el **costo de envío** al despachar un pedido y restarlo de la rentabilidad de la orden (margen = total − COGS − costo de envío).

### Cambio de schema (migración)

Añadir a `orders`:
- `shipping_cost numeric NOT NULL DEFAULT 0` — costo de envío asociado a la orden (lo paga el negocio, reduce el margen).

Sin trigger adicional: el campo es numérico simple, no requiere validación de dominio. Backfill = 0 para pedidos existentes.

### Cambios en API

**`src/features/logistics/api.ts`:**
- Extender `ShipmentOrder` con `shipping_cost: number`.
- Extender `ShipPayload` con `shipping_cost: number`.
- `useMarkShipped()` envía `shipping_cost` en el `update`.
- Nuevo hook `useUpdateShippingCost()` para editar el costo después (cuando ya está enviado).

**`src/features/orders/api.ts`:**
- Extender `Order` y `OrderWithItems` con `shipping_cost: number`.

**`src/features/bi/api.ts`:**
- En `useBiData`, traer `shipping_cost` en el select de orders.
- Nuevo acumulador `shippingCost` durante el loop de `validOrders`.
- `margin = revenue − cogs − shippingCost`.
- `marginPct` recalculado con el nuevo margen.
- En `monthlyClosure`, añadir `shipping` al bucket y restarlo del `margin` mensual.
- Exponer `shippingCost` en `BiData` para mostrarlo como KPI opcional.

### Cambios en UI

**`src/features/logistics/ShipDialog.tsx`:**
- Nuevo `Input type="number"` *"Costo de envío (COP)"* requerido (≥ 0). Estado `shippingCost`.
- Validación: número válido, no negativo. Pre-llenar con valor actual si ya existe.
- Pasar `shipping_cost` al `useMarkShipped` / `useUpdateShippingCost` según corresponda.
- Mostrar en el resumen del diálogo: total pedido, COGS estimado (si disponible) y margen tentativo (informativo, no bloqueante).

**`src/features/logistics/FulfillmentBoard.tsx`:**
- En `ShipmentCard`, mostrar el `shipping_cost` cuando exista.

**`src/features/orders/OrderDetails.tsx`:**
- Línea informativa: *Costo de envío: $X* (cuando > 0).
- Línea de margen: *Rentabilidad: total − COGS − envío*.

**`src/pages/Index.tsx` (dashboard):**
- KPI nuevo *"Costos de envío"* junto a COGS.
- Margen ya reflejará el nuevo cálculo automáticamente vía `useBiData`.

**`src/features/bi/MonthlyClosureTable.tsx`:**
- Nueva columna *"Envíos"* entre COGS y Margen.

### Archivos

**Migración nueva:** `ALTER TABLE orders ADD COLUMN shipping_cost numeric NOT NULL DEFAULT 0`.

**Modificados:**
- `src/features/logistics/api.ts` — tipos + `shipping_cost` en mutaciones + hook de update.
- `src/features/logistics/ShipDialog.tsx` — input requerido de costo de envío.
- `src/features/logistics/FulfillmentBoard.tsx` — mostrar costo en tarjeta.
- `src/features/orders/api.ts` — tipo extendido.
- `src/features/orders/OrderDetails.tsx` — mostrar envío y margen por orden.
- `src/features/bi/api.ts` — incluir `shipping_cost` en agregaciones, restar del margen.
- `src/features/bi/MonthlyClosureTable.tsx` — columna de envíos.
- `src/pages/Index.tsx` — KPI de costos de envío.

### Resultado
Al despachar un pedido el operador captura el costo de envío junto con la guía. Ese valor se guarda en la orden, se muestra en el detalle, y reduce el margen tanto a nivel de orden como en los KPIs y cierre mensual del dashboard. La fórmula de rentabilidad pasa a ser **total − COGS − envío**, manteniendo toda la lógica consistente entre `orders`, `order_items`, `product_materials` y `raw_materials`.

