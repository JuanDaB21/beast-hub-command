

## Plan: Calculadora de Cotización Rápida (efímera, WhatsApp)

### Objetivo
Herramienta táctica para el equipo de ventas: un panel lateral con calculadora que combina productos, envío y recargo COD, y genera un mensaje listo para copiar a WhatsApp. **No persiste nada** en la base de datos.

### Tarea 1 — Punto de entrada global (Navbar)

Inyectar el botón en el header global para que esté disponible desde cualquier módulo (no solo Órdenes).

- **`src/components/layout/AppShell.tsx`**: añadir un botón con icono `Calculator` (lucide) junto al `SidebarTrigger` en la barra superior. Tooltip *"Calculadora de cotización"*. Abre el `Sheet` de la calculadora.
- Estado local del shell `[quoteOpen, setQuoteOpen]` controla el Sheet.

### Tarea 2 — Componente `QuoteCalculatorSheet`

**Nuevo archivo**: `src/features/sales/QuoteCalculatorSheet.tsx`

Estructura (`Sheet side="right"`, ancho `sm:max-w-lg`):

**(a) Header**: título *"Calculadora de cotización"*, descripción *"Cálculos efímeros · no se guarda en la base de datos"*.

**(b) Lista de productos (dinámica)**: array local `items: { id, mode: 'catalog'|'manual', productId?, name, price, qty }`.
- Por línea:
  - `Tabs` (catálogo / manual) o un toggle simple.
  - **Catálogo**: `StandardCombobox` con productos activos vía `useProductsForOrder()` (ya existe en `src/features/orders/api.ts`). Al seleccionar, autorrellena `name` y `price`.
  - **Manual**: `Input` para nombre y `Input` numérico para precio.
  - `Input` cantidad (mínimo 1).
  - Subtotal de línea (currency, derecha).
  - Botón eliminar (`X`).
- Botón *"+ Agregar producto"*.

**(c) Envío**: `Switch` *"¿Aplica envío?"* → `Input` numérico costo (si on).

**(d) COD**: `Switch` *"¿Es Pago Contra Entrega (COD)?"* → `Input` numérico porcentaje (default = `useGlobalConfigs()['cod_transport_fee_percent'] ?? 5`).

**(e) Resumen (Card)**:
- Subtotal = `Σ(precio × cantidad)`.
- Envío.
- Comisión COD = `(subtotal + envío) × (% / 100)`.
- **Total final** (resaltado).

**(f) Mensaje WhatsApp (Card readonly)**:
```
¡Hola! 🐺 Aquí está el resumen de tu pedido en Beast Club:

• 2x Camiseta Blanca - $80.000
• 1x Hoodie Negro - $120.000

Subtotal: $200.000
Envío: $15.000
Comisión COD: $10.750
Total a pagar: $225.750
```
Renderizado como `<pre>` o `Textarea` readonly.

**(g) Acciones (footer sticky)**:
- Botón grande *"Copiar para WhatsApp"* (`navigator.clipboard.writeText` + toast confirmación).
- Botón secundario *"Limpiar"* (resetea estado).

### Tarea 3 — Hook helper de formato

Reutilizar el patrón `currency` ya presente en `Orders.tsx`. Inline o un util compartido en `src/lib/utils.ts` (`formatCurrency`).

### Archivos

**Nuevos:**
- `src/features/sales/QuoteCalculatorSheet.tsx`

**Modificados:**
- `src/components/layout/AppShell.tsx` — botón Calculator + Sheet montado.

### Restricciones cumplidas
- Cero escrituras a DB (no se llama `useCreateManualOrder` ni mutaciones).
- Solo lecturas: productos activos y configuración global.
- El estado vive en el componente y se resetea al limpiar/cerrar.

### Resultado
Desde cualquier módulo (incluyendo Órdenes), el vendedor abre la calculadora con un clic en el ícono superior. Arma la cotización mezclando productos del catálogo con líneas manuales, ajusta envío y COD, y copia un mensaje formateado listo para WhatsApp — sin tocar la operación real.

