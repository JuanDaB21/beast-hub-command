-- 027_unit_payment_run_orders.sql
--
-- Registro por pedido del pago de prendas vendidas. Hasta ahora el único control
-- contra el doble pago era el solape de fechas entre periodos, que se saltaba con
-- ?force=true o con una re-entrega (el trigger de 022 limpia delivered_at al salir
-- de 'delivered' y lo vuelve a poner con la fecha nueva). Con order_id como PK,
-- un pedido queda amarrado a UN solo pago, sin importar las fechas.

CREATE TABLE IF NOT EXISTS unit_payment_run_orders (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  run_id   UUID NOT NULL REFERENCES unit_payment_runs(id) ON DELETE CASCADE,
  units    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_unit_payment_run_orders_run
  ON unit_payment_run_orders(run_id);

-- Backfill: cada pedido entregado dentro del periodo de un pago ya generado queda
-- amarrado a ese pago. Si dos pagos se solapaban, se lo queda el más antiguo.
INSERT INTO unit_payment_run_orders (order_id, run_id, units)
SELECT DISTINCT ON (o.id) o.id, r.id, u.units
  FROM unit_payment_runs r
  JOIN orders o
    ON o.status = 'delivered'
   AND o.delivered_at >= r.period_from
   AND o.delivered_at <  r.period_to
  JOIN LATERAL (
    SELECT SUM(oi.quantity)::int AS units
      FROM order_items oi
     WHERE oi.order_id = o.id AND oi.kind = 'product'
  ) u ON u.units > 0
 ORDER BY o.id, r.created_at ASC
ON CONFLICT (order_id) DO NOTHING;
