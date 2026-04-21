

## Plan: Editar y eliminar transacciones manuales en Finanzas

### Objetivo
Permitir al usuario **editar** y **eliminar** ingresos/gastos creados manualmente desde el Libro Mayor. Las transacciones automáticas (origen RMA, pedido, devolución) seguirán siendo de solo lectura, ya que se gestionan desde su módulo origen.

### Cambios

**1. `src/features/finance/api.ts`**
- Agregar hook `useUpdateTransaction()` que actualiza `amount`, `category` y `description` de una transacción manual. Validará que `reference_type` sea `null` o `"manual"` antes de permitir el update (mismo guard que `useDeleteTransaction`).
- Invalida queries `financial_transactions` y `bi` al éxito.

**2. `src/features/finance/TransactionDialog.tsx`**
- Aceptar nueva prop opcional `transaction?: FinancialTransaction` para modo edición.
- Si se recibe `transaction`, precargar `amount`, `category`, `description` y cambiar el título a "Editar Ingreso/Gasto".
- En `handleSubmit`, decidir entre `useCreateTransaction` o `useUpdateTransaction` según el modo.
- Al guardar edición, mostrar toast "Transacción actualizada".

**3. `src/features/finance/FinanceLedgerTable.tsx`**
- Agregar botón de editar (ícono `Pencil`) junto al de eliminar, visible solo en transacciones manuales (`isManual`).
- Reorganizar la celda de acciones para alojar ambos botones en un `flex` compacto.
- Estado local nuevo: `editTarget: FinancialTransaction | null` que dispara el `TransactionDialog` en modo edición.

**4. `src/pages/Finance.tsx`**
- Adaptar el render del `TransactionDialog` para soportar también el modo edición disparado desde la tabla (subir el estado `editTarget` o instanciar un segundo dialog controlado desde la tabla — preferiblemente lo segundo para mantener el `Finance.tsx` simple).

### UX esperada

- En cada fila manual del Libro Mayor aparecen dos íconos: **editar** (lápiz) y **eliminar** (basura).
- Click en editar → abre el mismo modal usado para crear, pero precargado con los valores actuales y el título cambia a "Editar Ingreso" / "Editar Gasto".
- Guardar → actualiza la fila, refresca KPIs y resumen por categoría.
- Las transacciones automáticas siguen sin íconos de acción (igual que hoy).
- Eliminar conserva el `AlertDialog` de confirmación actual.

### Restricciones

- Solo se editan: `amount`, `category`, `description`. **No** se permite cambiar `transaction_type` ni `created_at` (mantiene la trazabilidad histórica).
- No se editan transacciones cuyo `reference_type` sea distinto de `"manual"` o `null`.
- No se requieren cambios de schema ni nuevas migraciones.

### Archivos a modificar

- `src/features/finance/api.ts`
- `src/features/finance/TransactionDialog.tsx`
- `src/features/finance/FinanceLedgerTable.tsx`
- `src/pages/Finance.tsx`

