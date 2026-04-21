

## Plan: Método de pago en pedidos manuales + desglose de ingresos por canal

### Objetivo
Permitir registrar el **método de pago** al crear pedidos manuales y mostrar en el dashboard el **desglose de ingresos por canal**.

### Métodos de pago
`Fisico`, `Nequi`, `Daviplata`, `Bancolombia`.

### Cambio de schema (migración)

Añadir a `orders`:
- `payment_method text NULL` — uno de `'fisico' | 'nequi' | 'daviplata' | 'bancolombia'` para pedidos manuales. NULL para pedidos Shopify (ya tienen su propio flujo de pago).

Validación vía trigger (no CHECK constraint) que valide el dominio de valores cuando no es NULL.

### Cambios en API

**`src/features/orders/api.ts`:**
- Extender `Order` y `NewOrderInput` con `payment_method?: 'fisico' | 'nequi' | 'daviplata' | 'bancolombia' | null`.
- `useCreateManualOrder()` envía `payment_method` al insertar.
- Exportar constante `PAYMENT_METHODS` con labels en español para reutilizar en UI.

**`src/features/bi/api.ts`:**
- Añadir hook `useRevenueByPaymentMethod()` que devuelve `{ method, label, total, count }[]` agrupando `orders` donde `payment_method IS NOT NULL` (manuales) sumando `total`. Considerar también un bucket separado para Shopify (`payment_method IS NULL`) etiquetado como "Shopify / Online".

### Cambios en UI

**`src/features/orders/NewOrderForm.tsx`:**
- Nuevo `Select` debajo del switch COD: *"Método de pago"*, opciones: Físico, Nequi, Daviplata, Bancolombia.
- Estado `paymentMethod`, validación: requerido al crear.
- Pasar `payment_method` al mutation.

**`src/features/orders/OrderDetails.tsx`:**
- Mostrar el método de pago como badge/línea informativa cuando exista.

**`src/pages/Index.tsx` (dashboard):**
- Nueva sección **"Ingresos por canal de pago"** con:
  - Tarjetas por método (Físico, Nequi, Daviplata, Bancolombia, Shopify/Online) mostrando monto + count.
  - Mini gráfico de barras horizontal (reutilizando `Charts.tsx` / Recharts ya presente).
- Colocada junto a los KPIs existentes.

### Archivos

**Migración nueva:** añade `payment_method` + trigger de validación.

**Modificados:**
- `src/features/orders/api.ts` — tipo + constante `PAYMENT_METHODS` + insert con método.
- `src/features/orders/NewOrderForm.tsx` — Select de método de pago.
- `src/features/orders/OrderDetails.tsx` — mostrar método de pago.
- `src/features/bi/api.ts` — hook `useRevenueByPaymentMethod`.
- `src/pages/Index.tsx` — sección de ingresos por canal.

### Resultado
Al crear un pedido manual el usuario elige el método de pago (Físico/Nequi/Daviplata/Bancolombia) y queda guardado en la orden. En el dashboard aparece un desglose de ingresos por canal con monto y cantidad por método, más un bucket separado para órdenes de Shopify.

