

## Plan: Drag & drop de órdenes en el board + flujo de despacho integrado

### Objetivo
Permitir mover tarjetas de pedido entre columnas del board de Órdenes con drag & drop. Al mover a **Enviado** o **Entregado** desde un estado anterior, se abre el modal de **Despachar pedido** (guía + costo de envío) y solo si se completa se aplica el cambio de estado.

### Comportamiento

- **Transiciones libres** entre `pending`, `in_production`, `ready_to_ship` (todas vía `useUpdateOrderStatus`).
- **Transición a `shipped` o `delivered`** desde un estado donde el pedido aún no tiene `tracking_number`:
  - Abre `ShipDialog` precargado con la orden.
  - Si la orden ya tiene `tracking_number` (re-envío), aplica el cambio directo (no re-pide guía).
  - Si el usuario cancela el diálogo, la tarjeta vuelve a su columna original (no se aplica el cambio).
  - Al confirmar el `ShipDialog` con guía + costo de envío, además del `shipped_at`/`tracking_number`/`shipping_cost` que ya guarda, se actualiza `status` al destino (`shipped` o `delivered`).
- **Transición desde `shipped`/`delivered` hacia atrás**: permitida, solo cambia status.
- **Cancelled**: drop permitido desde cualquier columna; sale por update simple.

### Cambios técnicos

**Librería:** usar `@dnd-kit/core` + `@dnd-kit/sortable` (ligero, accesible, ya común en stack React). Si no está instalado, se añade.

**`src/features/logistics/api.ts` — `useMarkShipped`:**
- Aceptar `target_status?: 'shipped' | 'delivered'` opcional (default `shipped`) para que el mismo flujo sirva al despachar desde el board de órdenes hacia "Entregado" directo.
- Update incluye `status = target_status`.

**`src/features/logistics/ShipDialog.tsx`:**
- Aceptar prop opcional `targetStatus?: 'shipped' | 'delivered'` y `onCancel?: () => void` (para revertir el optimistic en el board).
- Pasar `target_status` al mutation.

**`src/features/orders/OrdersBoard.tsx`:**
- Envolver con `DndContext` (sensors: pointer + keyboard).
- Cada columna = `Droppable` (id = status). Cada `OrderCard` = `Draggable` (id = order.id).
- Mantener `EntityDetailCard` clickeable: drag se activa con `activationConstraint: { distance: 6 }` para no chocar con el click que abre el detalle.
- Estilos: card semi-transparente al arrastrar, columna destino con highlight (`ring-2 ring-primary/40`).
- `onDragEnd`:
  - Si `over.id === active.data.status` → no-op.
  - Si destino ∈ {`shipped`,`delivered`} y la orden no tiene `tracking_number` → notificar al padre (`onRequestShip(order, targetStatus)`).
  - En otro caso → `onChangeStatus(order.id, targetStatus)`.
- Nuevas props: `onChangeStatus(id, status)` y `onRequestShip(order, status)`. (El `renderDetails` actual queda igual.)

**`src/pages/Orders.tsx`:**
- Estado nuevo `shipTarget: { order, targetStatus } | null`.
- `OrdersBoard` recibe:
  - `onChangeStatus`: llama a `updateStatus.mutateAsync({ id, status })` con toast.
  - `onRequestShip`: setea `shipTarget`.
- Renderizar `ShipDialog` (importado de logistics) controlado por `shipTarget`, pasando `order`, `targetStatus`, `open`, `onOpenChange`. Al cerrar sin éxito, simplemente se descarta (no hubo update, no hay nada que revertir).

**Móvil:**
- DnD funciona con touch (PointerSensor cubre touch). En pantallas pequeñas el board ya hace scroll horizontal; mantener.

### Archivos

**Modificados:**
- `src/features/orders/OrdersBoard.tsx` — DnD context, droppables, draggables, callbacks.
- `src/pages/Orders.tsx` — manejar `onChangeStatus`, `onRequestShip`, montar `ShipDialog`.
- `src/features/logistics/ShipDialog.tsx` — aceptar `targetStatus` y propagarlo.
- `src/features/logistics/api.ts` — `useMarkShipped` acepta `target_status` opcional.

**Dependencia nueva (si no existe):** `@dnd-kit/core`.

### Resultado
En `/pedidos` el usuario arrastra tarjetas entre columnas para cambiar el estado. Mover a **Enviado** o **Entregado** sin guía abre el modal de despacho; sin guía + costo de envío no se aplica el cambio. Cualquier otra transición se aplica al instante con toast de confirmación.

