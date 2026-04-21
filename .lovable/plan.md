
## Plan: Corregir de raíz el scroll del combobox “Seleccionar producto”

### Objetivo
Hacer que el combobox compartido funcione correctamente con listas largas dentro del modal de “Nuevo pedido manual”, especialmente el scroll con mouse, trackpad y touch, sin romper los otros formularios que usan `StandardCombobox`.

### Diagnóstico
El problema no es solo una clase de `max-height`. El componente actual combina:

- `Popover` de Radix renderizado en portal.
- `cmdk` (`Command`, `CommandList`) como lista interna.
- Un `DialogContent` padre con scroll propio.

Dentro del modal, esa combinación puede hacer que los eventos de rueda/touch se capturen por el diálogo o por las capas portaled/focus-trapped, por eso agregar `overflow-y-auto` no resuelve el problema de forma confiable.

### Cambio principal

Modificar `src/components/shared/StandardCombobox.tsx` para eliminar la dependencia de `Command/CommandList` dentro de este combobox y reemplazarla por una implementación nativa, controlada y robusta:

- Mantener la misma API pública:
  - `options`
  - `value`
  - `onChange`
  - `placeholder`
  - `searchPlaceholder`
  - `emptyText`
  - `disabled`
  - `className`
  - `allowClear`
- Mantener `Popover`, `PopoverTrigger` y `PopoverContent`.
- Dentro del popover:
  - Usar un `Input` normal para búsqueda.
  - Filtrar opciones localmente por `label`.
  - Renderizar la lista en un contenedor `div` con:
    - altura fija/máxima real (`max-h-72` o equivalente)
    - `overflow-y-auto`
    - `overscroll-contain`
    - soporte touch (`touch-pan-y`)
  - Usar botones/list items nativos para selección.
  - Evitar que eventos de rueda/touch se propaguen al modal padre cuando el cursor está sobre la lista.
- Mantener el ancho del dropdown igual al trigger:
  - `w-[--radix-popover-trigger-width]`
- Resetear el texto de búsqueda al cerrar o seleccionar.

### UX esperada

En “Órdenes” → “Nuevo pedido” → “Agregar línea” → “Seleccionar producto”:

- El dropdown abre correctamente.
- El buscador sigue funcionando.
- La lista tiene altura limitada.
- Se puede hacer scroll real dentro del dropdown.
- El scroll no mueve ni bloquea el modal padre.
- Seleccionar un producto sigue llenando el precio unitario.
- La opción de limpiar selección sigue funcionando donde `allowClear` esté activo.

### Archivos a modificar

- `src/components/shared/StandardCombobox.tsx`

### Validaciones posteriores

Después de implementar:

- Revisar que el formulario de “Nuevo pedido manual” siga creando líneas correctamente.
- Revisar que `StandardCombobox` conserve compatibilidad en:
  - producción
  - compras/sourcing
  - inventario
  - devoluciones
  - solicitudes de suministro
- Verificar visualmente que listas largas puedan desplazarse dentro del dropdown.
