-- 022_delivered_at_integrity.sql
--
-- delivered_at es la base del pago por prenda (unit-payments.ts cuenta por esa
-- fecha). El trigger de 020 solo cubría UPDATE y nunca limpiaba la fecha, lo que
-- dejaba dos huecos:
--   1. Un pedido creado directamente con status='delivered' (POST /api/orders
--      acepta status) quedaba con delivered_at NULL → invisible para el pago,
--      para siempre y sin forma de corregirlo desde la app.
--   2. Un pedido que sale de 'delivered' (cancelación, devolución que auto-cancela)
--      conservaba su delivered_at, dejando filas 'cancelled' con fecha de entrega.
--
-- La auditoría de 2026-09 encontró 0 filas afectadas por ambos casos, así que
-- esto es blindaje preventivo: no reescribe datos existentes.

CREATE OR REPLACE FUNCTION set_delivered_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'delivered' THEN
    -- INSERT directo como entregado, o transición hacia 'delivered'.
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered' THEN
      NEW.delivered_at = COALESCE(NEW.delivered_at, now());
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'delivered' THEN
    -- Sale de entregado: la entrega se deshizo, la fecha no debe sobrevivir o el
    -- pedido reaparecería en un periodo de pago al volver a entregarse.
    NEW.delivered_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_delivered_at ON orders;
CREATE TRIGGER trg_orders_delivered_at
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_delivered_at();

-- Higiene de datos: ningún pedido no entregado debe conservar fecha de entrega.
UPDATE orders SET delivered_at = NULL
 WHERE status <> 'delivered' AND delivered_at IS NOT NULL;
