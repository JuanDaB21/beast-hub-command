import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const ITEMS_SUBQUERY = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'product_id', oi.product_id,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'kind', oi.kind,
          'external_name', oi.external_name,
          'external_sku', oi.external_sku,
          'product', CASE WHEN p.id IS NOT NULL
            THEN json_build_object('id', p.id, 'sku', p.sku, 'name', p.name)
            ELSE NULL END
        )
        ORDER BY oi.created_at
      )
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ),
    '[]'::json
  ) AS items
`;

export const logisticsRouter = Router();

/** Ventana de COD entregados que sigue mostrando el tablero de recaudo. */
const COD_COLLECTED_WINDOW_DAYS = 60;

/**
 * GET /api/logistics/orders — pedidos del flujo logístico.
 *
 * Además del pipeline de despacho (pending → processing → shipped) incluye los
 * COD entregados: desde que Logística absorbió la página de COD, la pestaña de
 * recaudo vive aquí y necesita tanto los que siguen abiertos como los ya
 * cobrados recientes, para poder mostrar cuánto dinero tiene la transportadora.
 * Los entregados prepago quedan fuera: su ciclo terminó al despachar.
 */
logisticsRouter.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT o.*, ${ITEMS_SUBQUERY}
       FROM orders o
       WHERE o.status IN ('pending','processing','shipped')
          OR (
            o.is_cod AND o.status = 'delivered'
            AND (
              NOT o.cod_confirmed
              OR o.delivered_at >= now() - interval '${COD_COLLECTED_WINDOW_DAYS} days'
            )
          )
       ORDER BY o.created_at ASC`
    );
    res.json(rows);
  })
);
