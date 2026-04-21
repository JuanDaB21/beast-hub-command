

## Plan: Estado "Pedido confirmado" previo en gestión COD

### Objetivo
Añadir un paso previo de confirmación de pedido en el flujo COD para órdenes provenientes de Shopify. Las órdenes manuales saltan este paso.

### Flujo nuevo

**Manual (COD):** `Pendiente recaudo` → `Recaudo confirmado` (ingresa al dinero recaudado).

**Shopify (COD):** `Pendiente confirmación` → `Pedido confirmado` → `Recaudo confirmado` (ingresa al dinero recaudado).

Solo cuando `cod_confirmed = true` (recaudo) el pedido suma al "dinero ingresado".

### Cambio de schema (migración)

Añadir a `orders`:
- `order_confirmed boolean NOT NULL DEFAULT false` — marca si el pedido fue confirmado por el cliente (paso previo al recaudo).
- `order_confirmed_at timestamptz NULL` — fecha de confirmación del pedido.
- `confirmed_by_staff_id uuid NULL` — quién confirmó.

Backfill: las órdenes existentes con `source = 'manual'` se marcan `order_confirmed = true` (saltan el paso). Las de `source = 'shopify'` quedan en `false` salvo que ya estén `cod_confirmed`, en cuyo caso también `true`.

### Cambios en API (`src/features/cod/api.ts`)

- Extender `CodOrder` con `source`, `order_confirmed`, `order_confirmed_at`, `confirmed_by_staff_id`.
- Nuevo hook `useConfirmCodOrder()` — marca `order_confirmed = true`, setea `order_confirmed_at` y `confirmed_by_staff_id`.
- `useConfirmCodReceipt()` (existente) — sigue marcando `cod_confirmed = true` y `cod_received_at`. Validación: solo permite si `order_confirmed = true` o `source = 'manual'`.

### Cambios en `src/pages/Cod.tsx`

**Tabs nuevos** (reemplazan los actuales):
1. **Por confirmar** — `source = 'shopify'` AND `order_confirmed = false` AND `cod_confirmed = false`. Botón **"Confirmar pedido"**.
2. **Por recaudar** — (`order_confirmed = true` OR `source = 'manual'`) AND `cod_confirmed = false`. Botón **"Confirmar recaudo"**.
3. **Recaudados** — `cod_confirmed = true`. Solo lectura.
4. **Todos** — vista completa con badges del estado actual.

**KPIs ajustados:**
- *Pendientes de confirmación* (Shopify por confirmar) — count + monto.
- *Pendientes de recaudo* — count + monto.
- *Dinero recaudado* — suma de `total` donde `cod_confirmed = true` (esto es el "dinero ingresado").
- *Total COD* — count general.

**Tarjeta de pedido:**
- Badge de estado: `Pendiente confirmación` (rojo) / `Pedido confirmado` (amarillo) / `Recaudo confirmado` (verde).
- Para Shopify sin confirmar: botón primario "Confirmar pedido".
- Para confirmados (o manuales) sin recaudar: botón primario "Confirmar recaudo".
- Para recaudados: muestra fecha de confirmación de pedido (si aplica) + fecha de recaudo + staff.

### Archivos

**Migración:** nueva — añade `order_confirmed`, `order_confirmed_at`, `confirmed_by_staff_id` + backfill.

**Modificados:**
- `src/features/cod/api.ts` — tipos extendidos + `useConfirmCodOrder`.
- `src/pages/Cod.tsx` — nuevos tabs, KPIs, badges y botones por estado.

### Resultado
Pedidos COD desde Shopify pasan por dos clics: primero "Confirmar pedido" (cliente confirmó por WhatsApp/llamada), luego "Confirmar recaudo" cuando llega el dinero. Los manuales saltan directo al recaudo. El KPI "Dinero recaudado" solo cuenta pedidos con `cod_confirmed = true`.

