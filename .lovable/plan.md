

## Plan: Producto padre con variantes (multi-creación por checkbox)

### Objetivo
Convertir productos en un modelo **padre → hijos**:
- Un **producto padre** (ej. *Gymshark Training Shirt*) está atado a una **Base padre** de `raw_materials`.
- Sus **variantes hijas** son combinaciones de **Color × Talla × Estampado**, creadas masivamente desde checkboxes, cada una con su propio SKU, stock, stock de seguridad, aging, precio y `raw_material_id` específico.
- En la tabla de Inventario se ve una fila por **producto padre** que se expande para mostrar sus variantes.

### Cambio de schema (migración)

Añadir a `products`:
- `parent_id uuid NULL` → FK lógica al producto padre (sin constraint para evitar problemas, validación por app).
- `is_parent boolean NOT NULL DEFAULT false` → marca al padre (no tiene stock propio, solo agrupa).
- `print_design text NULL` → nombre del estampado de la variante (ej. "Estampado Negro").

Índice: `CREATE INDEX ON products(parent_id);`

Los registros existentes quedan como productos sueltos (`parent_id = null`, `is_parent = false`) — sin migración destructiva.

### Cambios en API (`src/features/inventory/api.ts`)

- Extender `Product` y `ProductInput` con `parent_id`, `is_parent`, `print_design`.
- Nuevo hook `useCreateProductWithVariants(parentInput, variants[])`:
  1. Crea el producto padre (`is_parent = true`, sin stock).
  2. Itera sobre el array de variantes seleccionadas y crea cada hija con su SKU autogenerado, `parent_id` apuntando al padre.
  3. Inserta el `product_materials` correspondiente para cada hija (apuntando al `raw_material_id` resuelto color×talla).
- Nuevo hook `useProductTree()` que devuelve `{ parents: ProductWithChildren[], orphans: Product[] }` agrupando hijos bajo su padre.

### Cambios en `ProductForm.tsx` — modo "Producto padre + variantes"

Rediseño en 4 secciones:

**1. Producto padre**
- SKU base (prefijo, ej. `GYM-TRAIN`), nombre padre (*Gymshark Training Shirt*), URL, descripción, activo.
- Combobox **Base padre** (igual que hoy) → determina los colores y tallas disponibles del raw_material.

**2. Selector de variantes (multi-checkbox)**
```
Colores disponibles (de la base):  ☑ Negro  ☑ Blanco  ☐ Gris
Tallas disponibles (de la base):   ☑ S  ☑ M  ☑ L  ☐ XL
Estampados (libre, agregables):    [+ Añadir estampado]
                                   ☑ Estampado Negro  ☑ Estampado Blanco
```
- Colores y tallas vienen del grupo de raw_materials (chips marcables).
- Estampados: input + botón "Añadir" → genera chips removibles. El usuario puede añadir tantos como quiera.

**3. Vista previa de variantes a crear**
Muestra tabla con todas las combinaciones `color × talla × estampado` seleccionadas:

```
SKU              | Nombre completo                          | Variante material
GYM-TRAIN-N-S-EN | Gymshark Training Shirt Negro S / EN     | Camiseta Oversize - Negro - S ✓
GYM-TRAIN-N-M-EN | Gymshark Training Shirt Negro M / EN     | Camiseta Oversize - Negro - M ✓
...
```
- Si alguna combinación no tiene raw_material disponible → fila marcada en rojo y excluida del submit.
- Contador: *"Se crearán 12 variantes"*.

**4. Defaults aplicados a todas las variantes**
- Stock inicial, stock seguridad, aging, precio venta, altura estampado → un input por defecto que se aplica a todas (editable individualmente después, en el detalle del producto padre).

### Cambios en `Inventory.tsx` y `ProductsTable.tsx`

- Listar solo productos padre (`is_parent = true`) + productos sueltos legacy (`parent_id = null && !is_parent`).
- Cada fila padre es expandible (`Collapsible`) y muestra dentro una mini-tabla con sus variantes hijas (SKU, color, talla, estampado, stock, aging, acciones editar/eliminar por variante).
- KPIs: agregar stock total/agotados sumando hijos del padre.

### Edición
- Editar **producto padre**: cambia nombre, descripción, URL, activo. No toca variantes.
- Editar **variante hija**: cambia stock, safety_stock, aging, precio, estampado, altura — formulario simple sin selector de base.
- Eliminar padre: confirma y elimina padre + todas sus hijas + sus `product_materials`.

### Modo legacy
Productos existentes sin `parent_id` siguen mostrándose como filas sueltas y editables con el formulario actual (sin romper nada).

### Archivos

**Migración:**
- Nueva migración SQL: añade columnas `parent_id`, `is_parent`, `print_design` + índice.

**Modificados:**
- `src/features/inventory/api.ts` — tipos extendidos + `useCreateProductWithVariants`, `useProductTree`, `useUpdateProductVariant`.
- `src/features/inventory/ProductForm.tsx` — rediseño completo con checkboxes, estampados dinámicos y vista previa.
- `src/features/inventory/ProductsTable.tsx` — filas expandibles padre→hijos.
- `src/features/inventory/ProductsMobileList.tsx` — tarjetas padre con acordeón de variantes.
- `src/pages/Inventory.tsx` — usar `useProductTree`, KPIs ajustados.

**Nuevos:**
- `src/features/inventory/VariantPreviewTable.tsx` — tabla de vista previa de combinaciones.
- `src/features/inventory/VariantEditDialog.tsx` — diálogo simple para editar una variante hija.

### Resultado
Crear *Gymshark Training Shirt* = 1) elegir base "Camiseta Oversize", 2) marcar `[Negro, Blanco] × [S, M, L]`, 3) añadir estampados `[Estampado Negro, Estampado Blanco]`, 4) ver vista previa de 12 variantes y confirmar. En `/inventory` aparece **1 fila padre** *"Gymshark Training Shirt · 12 variantes · stock total X"* expandible para gestionar cada variante con su propio stock, aging y BOM apuntando a la variante exacta de raw_materials.

