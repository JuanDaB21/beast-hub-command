

## Plan: Tab "Disponibles" en Inventario

### Objetivo
Añadir tabs en `/inventario` para alternar entre dos vistas:
- **Productos** (actual): jerarquía padre → variantes con todas las acciones de gestión.
- **Disponibles** (nueva): lista plana de variantes con stock > 0, solo lectura/consulta.

### Cambios en `src/pages/Inventory.tsx`

**1. Envolver el contenido con `Tabs`** (`@/components/ui/tabs`):
- Tab 1 — *"Productos"*: la vista actual sin cambios (KPIs + filtro + tabla padre/hijo + modales de creación/edición/borrado).
- Tab 2 — *"Disponibles"*: nueva vista.

**2. Vista "Disponibles"** — nuevo componente `src/features/inventory/AvailableVariantsList.tsx`:
- Aplana `parents.flatMap(p => p.children)` + `orphans`, filtra por `stock > 0` y `active = true`.
- Filtro por SKU/nombre (input propio).
- Mini-KPIs arriba: *Variantes disponibles*, *Stock total*, *En aging*.
- **Desktop (`lg:`)**: tabla con columnas SKU · Producto padre · Color · Talla · Estampado · Stock · Estado · Aging · Precio.
- **Mobile**: tarjetas compactas (nombre, SKU, badges de stock/aging, precio).
- Orden por defecto: stock descendente.
- Sin acciones de edición/borrado — es una vista de consulta rápida (ej. para ventas/picking).

**3. Persistencia del tab activo**: estado local `useState`, default `"productos"`.

### Archivos
- **Modificar**: `src/pages/Inventory.tsx` — envolver con `Tabs`, mover contenido actual al tab "Productos".
- **Nuevo**: `src/features/inventory/AvailableVariantsList.tsx` — componente con filtro, KPIs, tabla desktop y tarjetas mobile.

### Resultado
En `/inventario` el usuario ve dos pestañas: **Productos** (gestión completa actual) y **Disponibles** (solo variantes con stock > 0, vista plana de consulta con filtros y semáforo de stock/aging).

