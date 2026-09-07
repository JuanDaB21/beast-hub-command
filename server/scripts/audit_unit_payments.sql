-- ============================================================================
-- Auditoría: prendas a pagar (Finance › Pago prendas vendidas) vs. pedidos
-- entregados (Órdenes › historial).
--
-- SOLO LECTURA. No se ejecuta en el arranque; correr a mano:
--   psql "$DATABASE_URL" -f server/scripts/audit_unit_payments.sql
--
-- Referencia del conteo que se audita (server/routes/unit-payments.ts):
--   SUM(oi.quantity) WHERE oi.kind='product' AND o.status='delivered'
--                      AND o.delivered_at >= $1 AND o.delivered_at < $2
-- ============================================================================

\echo '== A. Reconciliación global =='
SELECT
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered')                      AS pedidos_entregados,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered'
                               AND o.delivered_at IS NULL)                        AS entregados_sin_fecha,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'delivered'
                                    AND oi.kind = 'product'), 0)                  AS prendas_pagables,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'delivered'
                                    AND oi.kind = 'unknown'), 0)                  AS prendas_unknown,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'delivered'
                                    AND oi.kind = 'fee'), 0)                      AS lineas_fee,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'delivered'
                                    AND oi.kind = 'product'
                                    AND o.delivered_at IS NULL), 0)               AS prendas_perdidas_sin_fecha
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id;

\echo ''
\echo '== B. Desfase temporal: mes de creación vs. mes de entrega (causa 1) =='
SELECT to_char(date_trunc('month', o.created_at),   'YYYY-MM') AS mes_creacion,
       to_char(date_trunc('month', o.delivered_at), 'YYYY-MM') AS mes_entrega,
       COUNT(DISTINCT o.id)  AS pedidos,
       SUM(oi.quantity)      AS prendas
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'delivered' AND oi.kind = 'product'
GROUP BY 1, 2
HAVING to_char(date_trunc('month', o.created_at),   'YYYY-MM')
       IS DISTINCT FROM
       to_char(date_trunc('month', o.delivered_at), 'YYYY-MM')
ORDER BY 1 DESC, 2 DESC;

\echo ''
\echo '== B2. Prendas por mes según cada criterio (para comparar de frente) =='
WITH por_creacion AS (
  SELECT to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS mes, SUM(oi.quantity) AS prendas
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'delivered' AND oi.kind = 'product'
  GROUP BY 1
), por_entrega AS (
  SELECT to_char(date_trunc('month', o.delivered_at), 'YYYY-MM') AS mes, SUM(oi.quantity) AS prendas
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'delivered' AND oi.kind = 'product' AND o.delivered_at IS NOT NULL
  GROUP BY 1
)
SELECT COALESCE(c.mes, e.mes) AS mes,
       COALESCE(c.prendas, 0) AS prendas_por_creacion,
       COALESCE(e.prendas, 0) AS prendas_por_entrega,
       COALESCE(e.prendas, 0) - COALESCE(c.prendas, 0) AS diferencia
FROM por_creacion c
FULL OUTER JOIN por_entrega e ON e.mes = c.mes
ORDER BY 1 DESC;

\echo ''
\echo '== C. delivered_at sospechoso (causa 2: backfill de la migración 020) =='
SELECT COUNT(*) FILTER (WHERE date_trunc('second', o.delivered_at)
                            = date_trunc('second', o.updated_at))       AS backfill_probable,
       COUNT(*) FILTER (WHERE o.delivered_at < o.created_at)            AS fecha_imposible,
       COUNT(*) FILTER (WHERE o.delivered_at IS NULL)                   AS sin_fecha,
       COUNT(*)                                                          AS total_entregados
FROM orders o
WHERE o.status = 'delivered';

\echo ''
\echo '== D. Líneas por kind en pedidos entregados (causas 3 y 9) =='
SELECT oi.kind,
       oi.product_id IS NULL AS sin_producto,
       COUNT(*)              AS lineas,
       SUM(oi.quantity)      AS prendas,
       (array_agg(DISTINCT COALESCE(oi.external_name, '(sin nombre)')))[1:10] AS muestra
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status = 'delivered'
GROUP BY 1, 2
ORDER BY prendas DESC NULLS LAST;

\echo ''
\echo '== E. Entregados auto-cancelados por devolución (causa 5) =='
SELECT o.order_number, o.delivered_at, o.updated_at, SUM(oi.quantity) AS prendas
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.cancelled_by_return
  AND o.delivered_at IS NOT NULL
  AND oi.kind = 'product'
GROUP BY 1, 2, 3
ORDER BY o.delivered_at DESC;

\echo ''
\echo '== F. Pagos ya generados vs. lo que contaría hoy el mismo periodo =='
SELECT r.period_from, r.period_to,
       r.units      AS pagado_entonces,
       (SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE oi.kind = 'product' AND o.status = 'delivered'
           AND o.delivered_at >= r.period_from
           AND o.delivered_at <  r.period_to)          AS contaria_hoy,
       r.rate_per_unit, r.total_amount,
       EXISTS (SELECT 1 FROM unit_payment_runs r2
                WHERE r2.id <> r.id
                  AND r2.period_from < r.period_to
                  AND r2.period_to   > r.period_from)  AS periodo_solapado
FROM unit_payment_runs r
ORDER BY r.period_to DESC;

\echo ''
\echo '== G. Volumen total (causa 8: LIMIT 5000 en GET /orders) =='
SELECT COUNT(*) AS pedidos_totales,
       COUNT(*) FILTER (WHERE status = 'delivered') AS entregados,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelados
FROM orders;

\echo ''
\echo '== H. Cancelados que conservan delivered_at (causa 6) =='
SELECT COUNT(*) AS cancelados_con_fecha_entrega
FROM orders
WHERE status = 'cancelled' AND delivered_at IS NOT NULL;

\echo ''
\echo '== I. Detalle por pedido entregado (para reconciliar a mano) =='
SELECT o.order_number,
       to_char(o.created_at,   'YYYY-MM-DD') AS creado,
       to_char(o.delivered_at, 'YYYY-MM-DD') AS entregado,
       COALESCE(SUM(oi.quantity) FILTER (WHERE oi.kind = 'product'), 0) AS prendas,
       COALESCE(COUNT(*)        FILTER (WHERE oi.kind = 'fee'), 0)      AS lineas_fee
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'delivered'
GROUP BY o.order_number, o.created_at, o.delivered_at
ORDER BY o.delivered_at DESC NULLS LAST;
