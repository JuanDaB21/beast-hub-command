# Auditoría: prendas a pagar vs. pedidos entregados

Fecha: 2026-09-06 · BD de producción (Railway) · consultas en
[`server/scripts/audit_unit_payments.sql`](../server/scripts/audit_unit_payments.sql)

## Conclusión

La diferencia se explica **por completo con una sola causa: el conteo de pago va por
fecha de entrega y el listado de pedidos mostraba fecha de creación.** No hay pérdida
ni duplicación de prendas; los dos números eran correctos y medían cosas distintas.

Septiembre 2026: el panel de pago cuenta **15 prendas**, el listado mostraba **4**.
Las 11 de diferencia son 8 pedidos de Shopify creados en agosto y entregados en
septiembre.

| Pedido | Creado | Entregado | Prendas |
|---|---|---|---|
| SHO-1788 | 26 ago | 3 sep | 1 |
| SHO-1789 | 27 ago | 3 sep | 2 |
| SHO-1790 | 27 ago | 3 sep | 1 |
| SHO-1791 | 27 ago | 6 sep | 1 |
| SHO-1792 | 27 ago | 1 sep | 1 |
| SHO-1793 | 28 ago | 1 sep | 2 |
| SHO-1794 | 28 ago | 3 sep | 1 |
| SHO-1796 | 31 ago | 5 sep | 2 |
| | | **Total** | **11** |

**El pago por prenda estaba correcto.** Pagar por fecha de entrega es lo justo: el
operario cobra cuando la prenda salió, no cuando entró el pedido.

## Cifras globales

| Métrica | Valor |
|---|---|
| Pedidos totales | 55 |
| Pedidos entregados | 38 |
| Prendas pagables (`kind='product'`) | 70 |
| Líneas de cargo (`kind='fee'`) | 20 |
| Prendas por mes de entrega | jun 2 · jul 12 · ago 41 · sep 15 |

## Causa secundaria: las líneas de cargo

En los 38 pedidos entregados hay **20 líneas `fee`** ("Comisión COD transportadora",
"Envío", "Envío estándar") que se ven en el detalle del pedido igual que una prenda.
Contando a mano desde el drawer salen 90 líneas en vez de 70 prendas. La columna
"Prendas" que ahora trae el listado aplica la regla real y evita ese error.

## Causas descartadas (volumen cero)

Se verificaron y **no aplican** a esta base:

| Hipótesis | Resultado |
|---|---|
| Líneas `kind='unknown'` de Shopify sin producto asignado | 0 |
| Entregados sin `delivered_at` | 0 |
| `delivered_at` heredado del backfill de la migración 020 | 0 |
| `delivered_at` anterior a `created_at` | 0 |
| Entregados auto-cancelados por devolución | 0 |
| Cancelados que conservan `delivered_at` | 0 |
| Truncamiento por `LIMIT 5000` en `GET /orders` | 55 pedidos, no aplica |
| Pagos ya generados con periodos solapados | 0 pagos generados hasta la fecha |

Varias de estas eran huecos reales del código aunque hoy no tuvieran filas; se
cerraron de forma preventiva (ver más abajo).

## Cambios aplicados

**El número de pago no cambió** — no se tocó la regla de conteo. Lo que cambió es
que ahora es visible y reconciliable.

- `server/lib/orderUnits.ts` — regla única de "qué es una prenda", espejada en el
  frontend por `isGarmentLine`/`countGarments` (`src/features/orders/api.ts`).
- Listado de pedidos: columna **Fecha entrega** (antes fecha de creación) y columna
  **Prendas** con el total al pie.
- Panel de pago: botón **Ver detalle** con el desglose pedido a pedido, resaltando en
  ámbar los que cruzan de mes.
- `GET /api/unit-payments/units/detail?from&to` — el endpoint que alimenta ese desglose.
- El KPI "Prendas vendidas" del dashboard usa la misma regla de línea. Sigue siendo una
  métrica distinta a propósito: mide **vendidas** (por fecha de creación, todo estado
  salvo cancelado), no **entregadas a pagar**.

**Blindaje preventivo** (sin efecto sobre los datos actuales):

- Migración `022_delivered_at_integrity.sql`: el trigger ahora cubre `INSERT` (un pedido
  creado directamente como entregado ya recibe fecha) y limpia `delivered_at` cuando el
  pedido sale de entregado.
- `POST /api/unit-payments` rechaza con `409` un periodo que se cruce con un pago ya
  generado; la UI ofrece "Generar de todos modos" para forzarlo.
- El gasto de nómina se imputa al periodo trabajado (`period_to`) y no al día en que se
  generó el pago.

## Pendiente conocido

`returns.ts` devuelve a `'pending'` un pedido cuya devolución se elimina, en vez de
restaurar el estado real previo (`delivered`/`shipped`). Con la migración 022 esto ya no
deja fechas de entrega huérfanas, pero el estado sigue siendo incorrecto. No se corrigió
porque exige guardar el estado anterior en una columna nueva y hoy hay **0 casos** en la
base. Vale la pena hacerlo antes de que aparezca el primero.
