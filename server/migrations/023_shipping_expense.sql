-- 023_shipping_expense.sql
--
-- El flete que la empresa le paga a la transportadora vivía en dos sitios que no
-- se hablaban:
--   1. orders.shipping_cost — lo captura el ShipDialog y es lo único que el
--      Dashboard resta del margen (src/features/bi/api.ts).
--   2. Un asiento manual que el operador tecleaba en el libro con la categoría
--      'Logística RMA' — que el Dashboard ignora (solo cuenta reference_type
--      'return') y que además contaminaba la categoría de fletes de devolución.
--
-- A partir de aquí el PATCH /api/orders/:id espeja shipping_cost en el libro
-- como un gasto con reference_type='shipping', uno por pedido. Este índice
-- parcial es lo que hace el upsert idempotente (ON CONFLICT ... WHERE).
--
-- NO se hace backfill de pedidos anteriores a propósito: los asientos manuales
-- ya registrados ('Envios a clientes') se quedan como historia, y generar los
-- automáticos ahora duplicaría el gasto en meses ya cerrados.

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_shipping_order_uniq
  ON financial_transactions (reference_id)
  WHERE reference_type = 'shipping';
