import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

/**
 * Lo que queda del módulo COD tras fusionarlo dentro de Logística.
 *
 * El feed propio (GET /orders) desapareció: Logística ya devuelve las mismas
 * órdenes completas y su pestaña de recaudo trabaja sobre ellas.
 *
 * El registro del recaudo (POST /orders/:id/receipt) también desapareció: ahora
 * el recaudo se deriva de la entrega, porque si la transportadora entregó,
 * cobró. Lo escribe PATCH /api/orders/:id al pasar a 'delivered', que además
 * deja el timestamp y el staff (cosa que el viejo atajo por PATCH no hacía).
 *
 * Sobrevive solo el hito 1: la llamada de confirmación previa al despacho.
 */
export const codRouter = Router();

const RETURN_COLUMNS = `
  id, order_number, customer_name, customer_phone, status, source, is_cod,
  order_confirmed, order_confirmed_at, confirmed_by_staff_id,
  cod_confirmed, total, tracking_number, shipped_at,
  cod_received_at, received_by_staff_id, created_at
`;

/**
 * POST /api/cod/orders/:id/confirm
 * Hito 1: el cliente confirmó por teléfono/WhatsApp que sí quiere el pedido.
 * Es el filtro anti-pedido-falso de los COD de Shopify, previo al despacho.
 * Único sitio que escribe order_confirmed_at y confirmed_by_staff_id.
 */
codRouter.post(
  '/orders/:id/confirm',
  asyncHandler(async (req, res) => {
    const staffId = req.user?.id ?? null;
    const { rows } = await pool.query(
      `UPDATE orders
       SET order_confirmed = true,
           order_confirmed_at = now(),
           confirmed_by_staff_id = $1
       WHERE id = $2
       RETURNING ${RETURN_COLUMNS}`,
      [staffId, String(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  })
);
