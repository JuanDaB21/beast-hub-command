

## Plan: Creador de Bases multi-variante

### Objetivo
Permitir crear múltiples variantes de una Base en una sola operación, generando automáticamente todas las combinaciones de tallas × colores como registros independientes en `raw_materials` (para preservar el control de stock por variante y la compatibilidad con BOM y solicitudes).

### Cambios en UI — `RawMaterialForm.tsx`

Rediseñar el formulario en modo "creador masivo":

1. **Datos compartidos** (aplican a todas las variantes):
   - Proveedor (combobox, requerido).
   - Categoría / Subcategoría (igual que hoy, con creación inline).
   - Nombre principal (texto, ej. "Camiseta Oversize"). Requerido.
   - Precio unitario, Unidad de medida, Stock inicial por variante.
   - SKU base (opcional) — si se ingresa, se sufija con color/talla.

2. **Selectores multi-valor** (reemplazan los selectores únicos de Color y Talla):
   - **Tallas**: chips multi-select sobre el catálogo `sizes`. UI con `Badge` clicable (toggle add/remove) + opción "Sin talla" para crear una variante sin talla.
   - **Colores**: chips multi-select sobre el catálogo `colors` (mostrando swatch del `hex_code`) + opción "Sin color".
   - Si el usuario no selecciona ninguna talla ni ningún color, se crea **una sola** variante (comportamiento equivalente al actual).

3. **Vista previa de matriz**:
   - Bloque debajo del formulario que calcula `tallas.length × colores.length` (tratando "ninguno" como 1) y lista los nombres que se generarán:
     - Formato: `"<Nombre principal> - <Color> - <Talla>"` (omitiendo segmentos vacíos).
   - Mensaje: *"Se crearán N variantes. ¿Confirmar?"*.
   - Si N > 20, mostrar advertencia visual antes de habilitar el botón.

4. **Botón submit** cambia a "Crear N variante(s)".

### Lógica de generación

En el handler de submit:

1. Construir el producto cartesiano `sizesSel × colorsSel` (con `[null]` cuando esté vacío).
2. Para cada combinación construir el payload de `raw_materials`:
   - `name` = `[principal, color?.name, size?.label].filter(Boolean).join(" - ")`.
   - `sku` = `skuBase ? \`${skuBase}-${color?.name ?? ""}${size?.label ?? ""}\` : null` (sanitizado).
   - `supplier_id`, `category_id`, `subcategory_id`, `unit_price`, `unit_of_measure`, `stock` compartidos.
   - `color_id`, `size_id` específicos de la variante.
3. **Validación de duplicados** (cliente):
   - Antes de insertar, leer `raw_materials` filtrando por `supplier_id` + `category_id` + `name IN (...)`.
   - Si hay coincidencias, mostrar toast con la lista omitida y continuar solo con las nuevas. Si todas existen, abortar con error.
4. **Inserción masiva**: una sola llamada `supabase.from("raw_materials").insert(payloads).select()`.
5. Toast de éxito: *"Se crearon X variantes (Y omitidas por duplicado)"*. Reset del formulario y `onSuccess()`.

### Cambios en API — `src/features/sourcing/api.ts`

- Agregar hook `useCreateRawMaterialsBatch()` que recibe `RawMaterialInput[]` y hace un único `insert`. Invalida `["raw_materials"]`.
- Mantener `useCreateRawMaterial` por compatibilidad.
- Agregar helper interno `findExistingVariantNames(supplierId, categoryId, names[])` para la validación de duplicados.

### Compatibilidad

- **BOM y Producción**: cada variante sigue siendo un registro `raw_materials` con su propio `id`, por lo que `product_materials`, `RecipeManager`, `RequirementsSummary` y selectores de bases en producción funcionan sin cambios.
- **Solicitudes a proveedor**: igual — operan sobre `raw_material_id` individual.
- **Listado en `Sourcing.tsx`**: ya muestra cada variante como tarjeta independiente con sus chips de color/talla; sin cambios.

### Archivos a modificar
- `src/features/sourcing/RawMaterialForm.tsx` — rediseño multi-variante con chips, vista previa y submit masivo.
- `src/features/sourcing/api.ts` — nuevo `useCreateRawMaterialsBatch` + helper de duplicados.

### Resultado
El usuario abre "Nueva base", escribe "Camiseta Oversize", selecciona chips `[S, M, L]` y `[Negro, Blanco]`, ve "Se crearán 6 variantes" con la lista, confirma, y los 6 registros aparecen al instante en el listado de Bases — listos para usarse en producción y solicitudes.

