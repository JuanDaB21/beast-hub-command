

## Plan: Refactor de Configuración + FinOps (libro mayor, RMA financiero, COD, simulador fiscal)

### Tarea 1 — Refactor del módulo de Configuración

Convertir `/configuracion` (`src/pages/Config.tsx`) en un panel con `Tabs` (ShadCN). Cada tab usa `Card`s para agrupar secciones.

- **Tab 1 · Usuarios (Staff)** → mover el listado y diálogos actuales (`NewStaffDialog`, `EditStaffDialog`).
- **Tab 2 · Costos de Producción** → renderiza `<PrintingConfigPanel />` (ya existente). En `src/pages/Production.tsx` se elimina la pestaña "Configuración de Estampado" (queda solo Lotes y Recetas).
- **Tab 3 · Comisiones y Pasarelas** → inputs para `shopify_fee_percent`, `gateway_fee_percent`, `gateway_fee_fixed`, `cod_transport_fee_percent`. Cada label con `Tooltip` explicando la aplicación.
- **Tab 4 · Proyección de Impuestos** → inputs para `estimated_iva_percent`, `estimated_retention_percent`. Encima de los inputs, **Card "Simulador Fiscal"** con: ingresos brutos del mes (suma de `orders.total` con `status != cancelled` del mes corriente), IVA estimado, retención estimada, y leyenda gris *"Estos valores son proyecciones informativas para futura formalización."*

**API extension** — `src/features/production/configApi.ts`:
- Ampliar `GlobalConfigId` con: `printing_cost_per_meter | ironing_cost | shopify_fee_percent | gateway_fee_percent | gateway_fee_fixed | cod_transport_fee_percent | estimated_iva_percent | estimated_retention_percent`.
- `useUpdateGlobalConfig` ya hace upsert genérico, sirve para todos.
- Nuevo helper `useGrossRevenueCurrentMonth()` (select sum de `orders` del mes).

**Nueva carpeta** `src/features/config/` con componentes:
- `StaffPanel.tsx` (extraído del actual Config).
- `CommissionsPanel.tsx`.
- `TaxesPanel.tsx` (incluye `FiscalSimulatorCard`).

### Tarea 2 — RMA con impacto financiero

**Schema (migración):** ya añadido en migración previa (`returns.company_assumes_shipping`, `returns.return_shipping_cost`).

**`src/features/returns/api.ts`:**
- Extender `ReturnRow` con `company_assumes_shipping: boolean`, `return_shipping_cost: number`.
- Extender `product` select con `cost`.
- Modificar `useResolveReturn`:
  - Aceptar `company_assumes_shipping`, `return_shipping_cost`, `product_cost` en el input.
  - Update de `returns` incluye `company_assumes_shipping` y `return_shipping_cost`.
  - Tras resolver, insertar en `financial_transactions`:
    - Si `resolution = 'scrapped'` y hay `product_cost > 0`:
      `{ transaction_type: 'expense', amount: product_cost, category: 'Pérdida por Merma', reference_type: 'return', reference_id, description: 'Merma producto X · pedido Y' }`.
    - Si `company_assumes_shipping = true` y `return_shipping_cost > 0`:
      `{ transaction_type: 'expense', amount: return_shipping_cost, category: 'Logística RMA', reference_type: 'return', reference_id, description: 'Flete devolución pedido Y' }`.

**`src/features/returns/ResolveReturnDialog.tsx`:**
- Nuevo `Switch` *"¿Asumimos el costo de envío?"*. Si on, mostrar `Input` numérico para `return_shipping_cost`.
- Pasar ambos al mutation; pasar también `product_cost = ret.product?.cost ?? 0`.
- Toast informativo con resumen de impacto financiero (merma + flete asumido).

### Tarea 3 — Lógica COD y Pasarelas

**`src/features/orders/NewOrderForm.tsx`:**
- Cuando `isCod = true`, leer `cod_transport_fee_percent` (vía `useGlobalConfigs`) y mostrar nuevo bloque de resumen:
  - Subtotal (suma items)
  - Comisión transportadora COD (`subtotal × cod_transport_fee_percent / 100`) — con `Tooltip` *"Esta comisión la cobra la transportadora al cliente en envíos contra entrega"*.
  - **Total a cobrar al cliente** = subtotal + comisión COD.
- Esa comisión se inyecta como **una línea adicional virtual** en el insert: opción elegida → enviar `unit_price` de los items tal cual; el surcharge se suma directo sobre `orders.total` mediante un trigger lógico en cliente: insertar una línea `order_items` adicional con `product_id = null`, `quantity = 1`, `unit_price = comisión`, descripción a través de un campo? **Mejor opción**: dado que `recalc_order_total` recalcula `total = SUM(qty × unit_price)`, añadimos la línea con `product_id = null` y `unit_price = comisión` para que el total quede correcto sin tocar el trigger ni schema.
  - Validación: solo cuando `is_cod = true` y comisión > 0.
- En `OrderDetails.tsx`, las líneas con `product = null` se mostrarán como *"Comisión COD transportadora"*.

**Órdenes Shopify (solo lectura) — `src/features/orders/OrderDetails.tsx`:**
- Si `order.source === 'shopify'`, mostrar Card "Comisiones estimadas":
  - Comisión Shopify = `total × shopify_fee_percent / 100`.
  - Comisión Pasarela = `total × gateway_fee_percent / 100 + gateway_fee_fixed`.
  - **Neto estimado a recibir** = `total − ambas comisiones`.
- Cada concepto con `Tooltip` y leyenda *"Cálculo informativo basado en configuración general."*.

### Tarea 4 — Libro Mayor (financial_transactions)

**Nuevo módulo** `src/features/finance/api.ts`:
- `useCreateTransaction()` — insert genérico en `financial_transactions`.
- Tipo `FinancialTransactionInput`.

Usado por `useResolveReturn` (Tarea 2). Preparado para consumirse desde otros flujos a futuro.

### Archivos

**Nuevos:**
- `src/features/finance/api.ts`
- `src/features/config/StaffPanel.tsx`
- `src/features/config/CommissionsPanel.tsx`
- `src/features/config/TaxesPanel.tsx`
- `src/features/config/FiscalSimulatorCard.tsx`

**Modificados:**
- `src/pages/Config.tsx` — Tabs container.
- `src/pages/Production.tsx` — quitar tab "Configuración de Estampado".
- `src/features/production/configApi.ts` — ampliar tipos + helper de ingresos del mes.
- `src/features/returns/api.ts` — campos financieros + creación de transacciones.
- `src/features/returns/ResolveReturnDialog.tsx` — switch + input flete.
- `src/features/orders/NewOrderForm.tsx` — cálculo COD + línea de comisión.
- `src/features/orders/OrderDetails.tsx` — Card de comisiones para Shopify; mostrar línea de comisión COD.

### Resultado

Configuración pasa a ser un panel unificado con cuatro pestañas. El FinOps queda activo: cada merma y cada flete asumido en RMA se asienta en el libro mayor; los pedidos COD muestran y cobran la comisión de la transportadora; los pedidos de Shopify revelan el neto real estimado; y un simulador fiscal proyecta IVA y retención del mes corriente.

