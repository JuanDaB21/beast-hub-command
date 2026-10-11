-- Las notificaciones "Nuevo pedido" llegan siempre de t.shopifyemail.com con
-- asunto "Pedido #…": se buscan directo, sin depender de una etiqueta en Gmail.
ALTER TABLE shopify_config
  ALTER COLUMN email_ingest_query SET DEFAULT 'from:t.shopifyemail.com subject:Pedido newer_than:3d';

UPDATE shopify_config
   SET email_ingest_query = 'from:t.shopifyemail.com subject:Pedido newer_than:3d'
 WHERE email_ingest_query = 'label:beasthub-pedidos newer_than:3d';
