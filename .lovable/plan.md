

## Plan: Agrupar Bases por nombre principal con variantes desplegables

### Objetivo
En la pestaña "Bases" de `/sourcing`, agrupar las variantes que comparten la misma "Base padre" (ej. *Camiseta Oversize*) en una sola tarjeta, y mostrar dentro las variantes (color × talla) con su stock individual.

### Lógica de agrupación
Cada `raw_material.name` tiene formato `"<Base> - <Color> - <Talla>"` (segmentos opcionales). Para agrupar:

- Extraer el **nombre base** removiendo del final los segmentos que coincidan con `color.name` y/o `size.label` de esa variante.
- Si una base no tiene color ni talla, queda como grupo de 1.
- Clave de grupo: `supplier_id + category_id + nombreBase` (evita mezclar bases homónimas de proveedores distintos).

### Cambios en UI — `src/pages/Sourcing.tsx` (tab "Bases")

Reemplazar el grid actual de tarjetas planas por una tarjeta por grupo:

**Tarjeta de grupo (colapsada por defecto)**
- Título: nombre base (ej. *Camiseta Oversize*).
- Subtítulo: proveedor · categoría/subcategoría.
- Métricas resumidas:
  - `N variantes`
  - `Stock total: Σ stock`
  - Mini-chips de colores únicos (swatches) y tallas únicas presentes.
  - `StatusBadge` rojo si **alguna** variante tiene `stock <= 0`, verde si todas tienen stock.
- Click → expande mediante `Collapsible` (ya disponible en `ui/collapsible.tsx`).

**Contenido expandido — tabla compacta de variantes**
Columnas: Color (swatch + nombre) · Talla · SKU · Precio · **Stock** (con badge verde/rojo) · Acción.
- Una fila por variante.
- Acción "Ver detalle" abre el `EntityDetailCard` drawer existente con todos los campos (igual que hoy), reutilizando la misma UI de detalle por variante.
- Si el grupo tiene una sola variante sin color/talla, se muestra la tabla con esa única fila (consistencia visual).

**Orden interno de variantes**: por `size.sort_order` y luego `color.name`.

**Buscador / filtro** (mejora ligera): mantener el listado tal cual, sin filtros nuevos en este iter (puede ser siguiente paso).

### Tab "Proveedores"
Sin cambios — el contador de "bases asociadas" por proveedor sigue contando registros individuales (variantes), que es correcto.

### Compatibilidad
- No se tocan API, esquema ni hooks. Solo es agrupación en cliente sobre el resultado de `useRawMaterials()`.
- BOM, producción y solicitudes siguen operando sobre cada variante por su `id`.

### Archivo a modificar
- `src/pages/Sourcing.tsx` — refactor del render de la pestaña "Bases" para agrupar por nombre base + render de tabla expandible con `Collapsible`.

### Resultado
En lugar de 8 tarjetas sueltas para "Camiseta Oversize" en sus 4 colores × 2 tallas, se ve **1 tarjeta** "Camiseta Oversize · 8 variantes · stock total 120" que al expandir muestra la grilla `Color × Talla` con el stock por celda y badges de bajo stock por variante.

