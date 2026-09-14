import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';
import { deliveredInRangeSql, garmentLineSql, notYetPaidSql } from '../lib/orderUnits';

export const unitPaymentsRouter = Router();

/**
 * Unidades a pagar en un periodo: prendas de pedidos EFECTIVAMENTE entregados
 * (delivered_at, el clic en Entregado) dentro de [from, to) y que aún no están
 * en ningún pago. La regla de prenda y de ventana vive en ../lib/orderUnits para
 * que el listado de pedidos y el KPI de prendas vendidas cuenten lo mismo.
 * Además informa lo entregado en el rango que ya se pagó (excluido).
 */
async function summarizeUnits(from: string, to: string) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity) FILTER (WHERE upo.order_id IS NULL), 0)::int AS units,
            COALESCE(SUM(oi.quantity) FILTER (WHERE upo.order_id IS NOT NULL), 0)::int
              AS already_paid_units,
            COUNT(DISTINCT o.id) FILTER (WHERE upo.order_id IS NOT NULL)::int
              AS already_paid_orders
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN unit_payment_run_orders upo ON upo.order_id = o.id
      WHERE ${garmentLineSql('oi')}
        AND ${deliveredInRangeSql('o', 1)}`,
    [from, to]
  );
  const r = rows[0] ?? {};
  return {
    units: Number(r.units ?? 0),
    already_paid_units: Number(r.already_paid_units ?? 0),
    already_paid_orders: Number(r.already_paid_orders ?? 0),
  };
}

/** Desglose por pedido del mismo número, para poder auditar de dónde sale. */
async function listUnitDetail(from: string, to: string) {
  const { rows } = await pool.query(
    `SELECT o.order_number,
            o.created_at,
            o.delivered_at,
            SUM(oi.quantity)::int AS units
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE ${garmentLineSql('oi')}
        AND ${deliveredInRangeSql('o', 1)}
        AND ${notYetPaidSql('o')}
      GROUP BY o.id, o.order_number, o.created_at, o.delivered_at
      ORDER BY o.delivered_at DESC`,
    [from, to]
  );
  return rows;
}

function parseRange(req: { query: Record<string, unknown> }) {
  const from = typeof req.query.from === 'string' ? req.query.from : null;
  const to = typeof req.query.to === 'string' ? req.query.to : null;
  return { from, to };
}

/**
 * GET /units?from&to — unidades entregadas en el periodo aún sin pagar, lo ya
 * pagado que se excluyó, y los pagos cuyo periodo se cruza (solo informativo:
 * el doble pago lo impide el registro por pedido).
 */
unitPaymentsRouter.get(
  '/units',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req);
    if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos' });

    const summary = await summarizeUnits(from, to);
    const { rows: overlapping } = await pool.query(
      `SELECT id, period_from, period_to, units, rate_per_unit, total_amount
         FROM unit_payment_runs
        WHERE period_from < $2 AND period_to > $1
        ORDER BY period_to DESC`,
      [from, to]
    );
    res.json({ ...summary, overlapping_runs: overlapping });
  })
);

/**
 * GET /units/detail?from&to — los pedidos que componen ese número. Existe para
 * que una diferencia contra el listado de pedidos sea rastreable pedido a pedido
 * en vez de una discusión sobre el total.
 */
unitPaymentsRouter.get(
  '/units/detail',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req);
    if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos' });
    res.json(await listUnitDetail(from, to));
  })
);

unitPaymentsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT r.*,
              CASE WHEN p.id IS NOT NULL
                THEN json_build_object('id', p.id, 'full_name', p.full_name)
                ELSE NULL END AS created_by
         FROM unit_payment_runs r
         LEFT JOIN profiles p ON p.id = r.created_by_staff_id
        ORDER BY r.period_to DESC, r.created_at DESC`
    );
    res.json(rows);
  })
);

interface NewRunBody {
  period_from?: string;
  period_to?: string;
  rate_per_unit?: number;
  notes?: string | null;
}

/**
 * POST / — genera la solicitud de pago. Los pedidos se amarran al run en
 * unit_payment_run_orders (order_id PK) y las unidades salen de esas filas, no
 * del cliente: un pedido nunca entra en dos pagos, aunque los periodos se crucen
 * o el pedido se re-entregue. El asiento de gasto queda ligado al run por
 * reference_type='unit_payment', lo que además lo hace no editable desde el
 * libro de finanzas (finance.ts solo permite editar 'manual').
 */
unitPaymentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body as NewRunBody;
    const rate = Number(b.rate_per_unit);
    if (!b.period_from || !b.period_to) {
      return res.status(400).json({ error: 'period_from y period_to son requeridos' });
    }
    if (new Date(b.period_to) <= new Date(b.period_from)) {
      return res.status(400).json({ error: 'El periodo final debe ser posterior al inicial' });
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      return res.status(400).json({ error: 'El valor por unidad debe ser mayor a 0' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: draftRows } = await client.query(
        `INSERT INTO unit_payment_runs
           (period_from, period_to, units, rate_per_unit, total_amount, notes, created_by_staff_id)
         VALUES ($1, $2, 0, $3, 0, $4, $5)
         RETURNING id`,
        [b.period_from, b.period_to, rate, b.notes ?? null, req.user?.id ?? null]
      );
      const runId = draftRows[0].id;

      // Amarra al run los pedidos entregados en el periodo que aún no se pagaron.
      // Si una petición concurrente tomó alguno, la PK de order_id aborta (23505).
      const { rows: linked } = await client.query(
        `INSERT INTO unit_payment_run_orders (order_id, run_id, units)
         SELECT o.id, $3, SUM(oi.quantity)::int
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE ${garmentLineSql('oi')}
            AND ${deliveredInRangeSql('o', 1)}
            AND ${notYetPaidSql('o')}
          GROUP BY o.id
         RETURNING units`,
        [b.period_from, b.period_to, runId]
      );
      const units = linked.reduce((s, r) => s + Number(r.units), 0);
      if (units <= 0) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: 'No hay prendas entregadas pendientes de pago en ese periodo' });
      }
      const total = units * rate;

      const { rows: runRows } = await client.query(
        `UPDATE unit_payment_runs SET units = $1, total_amount = $2 WHERE id = $3 RETURNING *`,
        [units, total, runId]
      );
      const run = runRows[0];

      const { rows: txRows } = await client.query(
        `INSERT INTO financial_transactions
           (transaction_type, amount, category, reference_type, reference_id, description, occurred_at)
         VALUES ('expense', $1, 'Nómina', 'unit_payment', $2, $3, $4)
         RETURNING id`,
        [
          total,
          run.id,
          `Pago por ${units} prendas vendidas · ${new Date(b.period_from).toLocaleDateString('es-CO')} a ${new Date(b.period_to).toLocaleDateString('es-CO')}`,
          // El gasto se imputa al periodo trabajado, no al día en que se generó:
          // un pago de enero creado en febrero debe pesar en enero.
          b.period_to,
        ]
      );

      await client.query('UPDATE unit_payment_runs SET financial_transaction_id = $1 WHERE id = $2', [
        txRows[0].id,
        run.id,
      ]);

      await client.query('COMMIT');
      res.status(201).json({ ...run, financial_transaction_id: txRows[0].id });
    } catch (err) {
      await client.query('ROLLBACK');
      if ((err as { code?: string }).code === '23505') {
        return res
          .status(409)
          .json({ error: 'Otro pago acaba de incluir algunos de estos pedidos. Recarga e inténtalo de nuevo.' });
      }
      throw err;
    } finally {
      client.release();
    }
  })
);

/** DELETE /:id — borra el run y su asiento; el CASCADE libera sus pedidos para un pago futuro. */
unitPaymentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM financial_transactions
          WHERE reference_type = 'unit_payment' AND reference_id = $1`,
        [id]
      );
      const { rowCount } = await client.query('DELETE FROM unit_payment_runs WHERE id = $1', [id]);
      await client.query('COMMIT');
      if (!rowCount) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);
