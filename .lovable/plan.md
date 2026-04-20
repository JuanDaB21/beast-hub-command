

## Plan: Selector de Base → Color/Talla derivados de variantes

### Objetivo
Eliminar los campos libres de "Talla" y "Color base" en el formulario de productos. En su lugar, al seleccionar la **Base padre**, el sistema mostrará dropdowns de Color y Talla únicamente con las variantes existentes de esa base en `raw_materials`, y enlazará el producto a la **variante específica** (color + talla) para que las alertas de inventario apunten al registro correcto.

### Cambios en `src/features/inventory/ProductForm.tsx`

**1. Reemplazar los 3 inputs de texto** (`size`, `base_color`, `print_color`) por una sección estructurada:

```
┌─ Base padre [Combobox: nombre base · proveedor] ──────┐
│  Color base  [Select: solo colores con variantes]     │
│  Talla       [Select: solo tallas con variantes]      │
│  Estampado   [Input texto libre]   ← se mantiene      │
└────────────────────────────────────────────────────────┘
```

**2. Agrupar `raw_materials` por base padre** (reutilizando la lógica de `MaterialGroupCard.tsx` — extraer `extractBaseName` a un helper compartido en `src/features/sourcing/groupHelpers.ts`):
- Clave: `supplier_id + category_id + baseName`.
- Cada grupo expone: `baseName`, lista de `variants`, set de colores únicos, set de tallas únicas.

**3. Lógica de selección encadenada**:
- Al elegir grupo base → poblar Selects de Color y Talla con valores únicos del grupo.
- Al elegir Color y Talla → resolver la variante exacta:  
  `variant = group.variants.find(v => v.color_id === selectedColorId && v.size_id === selectedSizeId)`
- Si la combinación no existe en el grupo, mostrar mensaje *"Esta combinación no está disponible como variante. Créala primero en Bases."* y bloquear submit.
- `form.base_material_id` apunta a la variante específica resuelta (no al grupo).

**4. Persistencia en `products`**:
- `base_color` ← `color.name` resuelto (texto, para mostrar en tablas/UI).
- `size` ← `size.label` resuelto.
- Los campos siguen guardándose como string en `products` (sin migración de schema).
- `print_color` se mantiene como input libre.

**5. Vínculo BOM (sin cambios de schema)**:
- `product_materials` se enlaza con la **variante** (`raw_material_id` específico), no con el grupo.
- Esto garantiza que las alertas de stock bajo, solicitudes a proveedor y consumo en `complete_work_order` apunten al `raw_material` correcto (la variante que comparte color/talla con el producto).

**6. Comportamiento al editar**:
- Al cargar un producto existente, leer `existingBom[0].raw_material_id`, encontrar el grupo padre y prefijar Base/Color/Talla automáticamente.

**7. Nombre automático**: sigue armándose como `<base padre> <talla> <color base> / <estampado>` con los valores resueltos.

### Helper nuevo
- `src/features/sourcing/groupHelpers.ts` — exporta `extractBaseName(material)` y `groupMaterials(materials)` actualmente locales en `MaterialGroupCard.tsx`. Refactor: importar desde el helper en ambos lugares (no duplicar).

### Archivos a modificar
- `src/features/inventory/ProductForm.tsx` — rediseño de la sección Base/Color/Talla con selectores encadenados.
- `src/features/sourcing/MaterialGroupCard.tsx` — importar helpers desde el nuevo módulo.
- `src/features/sourcing/groupHelpers.ts` — **nuevo**, contiene la lógica de agrupación reutilizable.

### Resultado
Crear un producto = 1) elegir "Camiseta Oversize" (base padre), 2) elegir color "Negro" y talla "M" de las opciones disponibles en esa base, 3) escribir estampado. El producto queda enlazado a la variante exacta `Camiseta Oversize - Negro - M`, y cualquier alerta o solicitud automática apunta directamente a ese `raw_material_id`.

