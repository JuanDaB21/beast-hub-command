-- =========================================================
-- 021_return_auto_cancel.sql
-- Un pedido devuelto por completo y que aún no se cobró no se va a entregar:
-- se cancela solo. La marca permite deshacer esa cancelación si la devolución
-- se elimina después.
-- =========================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_by_return BOOLEAN NOT NULL DEFAULT false;
