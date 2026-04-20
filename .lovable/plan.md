

## Plan: Cálculo de necesidades de insumos al producir referencias

### Contexto
Las **referencias estampadas** (productos finales en `products`) ya pueden tener una receta (BOM) en `product_materials` que apunta a sus componentes en `raw_materials`. Los **productos base** (camisetas en blanco) viven en `raw_materials` junto con los stickers DTF. La función `complete_work_order` ya descuenta correctamente los insumos y suma stock al producto final.

El problema real: **al armar un lote no se ve qué insumos hacen falta ni cuántos comprar**. Vamos a hacer ese cálculo visible.

### Cambios

**1. Receta (Recetas BOM) — UX más clara** (`RecipeManager.tsx`)
- Renombrar "Insumo" a "Componente / Insumo" para reflejar que aplica tanto a bases como a stickers.
- Al seleccionar un producto, mostrar un banner: "Define todos los componentes necesarios para producir 1 unidad (camiseta base + sticker + hilos, etc.)".
- Mostrar el stock actual del componente al lado de la cantidad requerida con badge de color (verde si alcanza para 10+ unidades, ámbar si poco, rojo si 0).

**2. Nuevo: Resumen de necesidades en `NewWorkOrderForm.tsx`**

Al agregar productos y cantidades al lote, calcular y mostrar en tiempo real una tabla:

```text
Componente              Requerido   Stock actual   Faltante / Comprar
Camiseta Negra Oversize L    50          12             38 unidades
Sticker DTF "Beast"          50          200            ✓ Suficiente
Hilo negro (m)               25          5              20 m
```

- Hook nuevo `useProductMaterialsBatch(productIds)` en `production/api.ts` — un solo fetch del BOM de todos los productos del lote.
- Componente `ProductionRequirementsSummary` que recibe los items del draft y agrega: `cantidad_requerida = quantity_to_produce × quantity_required` por componente, suma duplicados, y compara con `raw_materials.stock`.
- Banner de advertencia si hay faltantes: "Faltan X componentes para completar este lote — considera ajustar cantidades o reabastecer antes de iniciar."
- Aviso si algún producto no tiene receta definida: link rápido a la pestaña "Recetas".

**3. Visualización en detalle del lote** (`WorkOrderDetails.tsx`)
- Nueva pestaña "Componentes requeridos" junto a "Resumen" y "DTF" que muestre la misma tabla de necesidades para el lote ya creado, útil para revisión antes de iniciar/completar.

**4. Sin cambios de schema**
La estructura `products → product_materials → raw_materials` ya soporta todo el flujo. El RPC `complete_work_order` ya:
- Verifica stock suficiente de cada `raw_material` (incluyendo bases).
- Resta `quantity_required × quantity_to_produce` de `raw_materials.stock`.
- Suma `quantity_to_produce` a `products.stock`.

### Archivos afectados
- `src/features/production/api.ts` — agregar `useProductMaterialsBatch`.
- `src/features/production/RequirementsSummary.tsx` — nuevo componente.
- `src/features/production/NewWorkOrderForm.tsx` — integrar el resumen.
- `src/features/production/WorkOrderDetails.tsx` — nueva pestaña.
- `src/features/production/RecipeManager.tsx` — mejoras de UX y badges de stock.

### Resultado esperado
Al armar un lote de "GYMSHARK Training Shirt L × 50", el usuario ve inmediatamente que necesita 50 camisetas base + 50 stickers, cuánto tiene y cuánto debe comprar — antes de crear la orden de trabajo.

