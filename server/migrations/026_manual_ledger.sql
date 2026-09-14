-- 026_manual_ledger.sql
--
-- El libro de finanzas pasa a ser SOLO lo realmente transferido, registrado a
-- mano. La única excepción automática es el pago de prendas vendidas
-- (reference_type='unit_payment').
--
-- Se eliminan los asientos que generaba el servidor:
--   · 'shipping' → espejo de orders.shipping_cost (migración 023). El flete sigue
--     en orders y se concilia contra lo pagado en la tarjeta "Envíos del mes".
--   · 'return'   → merma y flete RMA al resolver una devolución. Los datos siguen
--     en la fila de returns y el Dashboard los descuenta del margen desde ahí.

DELETE FROM financial_transactions
 WHERE reference_type IN ('shipping', 'return');

DROP INDEX IF EXISTS financial_transactions_shipping_order_uniq;
