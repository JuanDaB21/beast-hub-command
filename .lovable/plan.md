
## Plan: Corregir scroll del combobox en “Nuevo pedido manual”

### Objetivo
Ajustar el componente compartido `StandardCombobox` para que la lista de productos con buscador pueda desplazarse correctamente dentro del modal de creación de pedido manual.

### Cambio principal

Modificar `src/components/shared/StandardCombobox.tsx` para que el scroll sea controlado por el contenido del popover, no por el modal padre.

Se aplicará:

- `PopoverContent` con altura máxima basada en el espacio disponible en pantalla:
  - `max-h-[var(--radix-popover-content-available-height)]`
  - `overflow-hidden`
- `CommandList` con altura máxima real y scroll interno:
  - `max-h-[min(300px,var(--radix-popover-content-available-height))]`
  - `overflow-y-auto`
  - `overscroll-contain`
- Mantener el ancho actual:
  - `w-[--radix-popover-trigger-width]`
- Mantener el comportamiento actual de búsqueda, selección, limpieza y cierre del popover.

### Ajuste específico para el caso del modal

Como el combobox se usa dentro de `DialogContent` en `src/pages/Orders.tsx`, el ajuste evitará que la rueda/scroll del mouse se “pierda” en el scroll del diálogo y permitirá navegar listas largas de productos desde el propio dropdown.

### Archivos a modificar

- `src/components/shared/StandardCombobox.tsx`

### Resultado esperado

En “Órdenes” → “Nuevo pedido” → selector de producto:

- El dropdown abre normalmente.
- El buscador sigue funcionando.
- La lista de productos muestra una altura limitada.
- Se puede hacer scroll con mouse/touchpad dentro del select.
- El cambio beneficia también otros formularios que usan `StandardCombobox`, sin alterar su API ni la lógica de pedidos.