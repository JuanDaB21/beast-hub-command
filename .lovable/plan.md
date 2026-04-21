

## Plan: Módulo Finanzas · Libro Mayor con UI completa

### Objetivo
Crear una sección **Finanzas** en el menú con una UI tipo libro mayor: tabla filtrable de todas las transacciones (`financial_transactions`), KPIs de ingresos/gastos/balance, y formularios para registrar manualmente ingresos y gastos. Centraliza tanto los movimientos automáticos (RMA, futuros pagos) como los manuales.

### Tarea 1 — Nueva ruta y entrada en el menú

- **`src/lib/modules.ts`**: añadir módulo `finanzas` → path `/finanzas`, título *"Libro Mayor · Finanzas"*, icono `BookOpen` (lucide).
- **`src/components/layout/AppSidebar.tsx`**: añadir nueva sección *"Finanzas"* con el slug `finanzas` (entre "Lotes y producción" y "General"), o agregarlo a "General". Preferimos sección propia para resaltarlo.
- **`src/App.tsx`**: registrar `<Route path="/finanzas" element={protect(<Finance />)} />`.
- **Nueva página** `src/pages/Finance.tsx` (usa `AppShell`).

### Tarea 2 — API extendida `src/features/finance/api.ts`

Añadir:
- `FinancialTransaction` (tipo Row).
- `useFinancialTransactions(filters)` → `useQuery` con filtros por `transaction_type`, `category`, rango de fechas (`from` / `to`), búsqueda libre en `description`. Ordena por `created_at desc`.
- `useFinancialSummary(filters)` → calcula `totalIncome`, `totalExpense`, `balance`, `byCategory[]` con los mismos filtros (puede derivarse en cliente del query anterior, o una segunda query agregada).
- `useDeleteTransaction()` → para corregir errores de captura (solo manuales). Bloquear DELETE si `reference_type !== 'manual'` (validación cliente).
- Mantener `useCreateTransaction` (ya existe).

### Tarea 3 — UI del Libro Mayor (`src/pages/Finance.tsx`)

Layout en `AppShell` con título *"Libro Mayor"*:

**(a) Fila de KPIs (Card grid 4 columnas):**
- Ingresos del periodo (verde).
- Gastos del periodo (rojo).
- Balance neto (color dinámico).
- # de movimientos.

**(b) Barra de filtros (Card):**
- `Select` Tipo: Todos / Ingreso / Gasto.
- `Select` Categoría: opciones distintas existentes en BD + categorías predefinidas (Pérdida por Merma, Logística RMA, Pago manual, Ingreso manual, Reembolso, Otro).
- `DateRangePicker` (usar `Calendar` + `Popover` patrón ShadCN) para rango. Por defecto: mes corriente.
- `Input` búsqueda por descripción.
- Botón *"Limpiar filtros"*.
- Dos botones primarios al extremo derecho: **"+ Registrar Ingreso"** y **"+ Registrar Gasto"** (variant destructive).

**(c) Tabla principal (`Table` ShadCN):**
Columnas: Fecha · Tipo (badge income/expense) · Categoría · Descripción · Origen (`reference_type`: manual/return/order, badge) · Monto (alineado derecha, color por tipo) · Acciones (eliminar solo si `reference_type='manual'`, con `AlertDialog` de confirmación).

Pie de tabla con totales del filtro aplicado.

**(d) Card "Resumen por categoría":** lista compacta `categoría → total ingreso / gasto` con barras de progreso relativas.

### Tarea 4 — Diálogo de registro (`src/features/finance/TransactionDialog.tsx`)

Componente reusable controlado por prop `mode: 'income' | 'expense'`:
- `Input` Monto (numérico, requerido > 0).
- `Combobox`/`Input` Categoría (sugerencias preestablecidas según modo: 
  - Ingreso: *Pago Shopify*, *Pago COD*, *Ingreso manual*, *Reembolso recibido*, *Otro*. 
  - Gasto: *Pago a proveedor*, *Nómina*, *Servicios*, *Logística*, *Marketing*, *Pérdida por Merma*, *Logística RMA*, *Otro*).
- `Textarea` Descripción.
- Marca `reference_type = 'manual'`.
- Botón Guardar → `useCreateTransaction`.
- Toast con resumen.

### Tarea 5 — Integración con dashboard existente

Sin cambios visuales en `Index.tsx`/`MonthlyClosureTable`. El libro mayor es la fuente de verdad financiera; los KPIs actuales seguirán derivando de `orders` (no se duplican). Aclaración visual al pie del libro mayor: *"Los movimientos automáticos (RMA, mermas) se registran al resolverse en cada módulo. Los pagos a proveedores e ingresos extra-orden se capturan aquí."*

### Archivos

**Nuevos:**
- `src/pages/Finance.tsx`
- `src/features/finance/TransactionDialog.tsx`
- `src/features/finance/FinanceLedgerTable.tsx`
- `src/features/finance/FinanceFilters.tsx`
- `src/features/finance/FinanceKpis.tsx`

**Modificados:**
- `src/features/finance/api.ts` — añadir queries, summary, delete.
- `src/lib/modules.ts` — entrada `finanzas`.
- `src/components/layout/AppSidebar.tsx` — sección/slug nuevo.
- `src/App.tsx` — ruta `/finanzas`.

### Resultado
Aparece la sección **Finanzas → Libro Mayor** en el sidebar. La página muestra KPIs de ingresos/gastos/balance, una tabla filtrable por tipo, categoría, fecha y texto, y permite registrar ingresos y gastos manuales. Los asientos automáticos (mermas, fletes RMA) se ven junto a los manuales con su origen claramente marcado, dando trazabilidad completa de la operación financiera.

