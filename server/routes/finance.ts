import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler } from '../util';

const INSERT_COLS = [
  'transaction_type',
  'amount',
  'category',
  'reference_type',
  'reference_id',
  'description',
  'charged_to_staff_id',
  'occurred_at',
  'payment_method',
  'source',
];

const SALES_SOURCES = ['shopify', 'manual'] as const;

/**
 * Vías por las que entra la plata. Coinciden con el CHECK de
 * financial_transactions.payment_method, que es lo que permite conciliar los dos
 * lados sin traducir nada.
 */
const PAYMENT_CHANNELS = ['bancolombia', 'nequi', 'daviplata', 'fisico', 'cod'] as const;

/**
 * Nombres con los que nace la línea de cargo por envío en order_items. No hay
 * categoría en esa tabla, así que el nombre es lo único que distingue el envío
 * de los otros cargos (comisión COD). Espejo de SHIPPING_FEE_NAMES en
 * src/features/orders/api.ts.
 */
const SHIPPING_FEE_NAMES = ['Envío estándar', 'Envío'];

/** Convierte un YYYY-MM (o el mes actual si es inválido) al rango UTC [start, end). */
function monthRange(month: string): { start: Date; end: Date; label: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  const start = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) : new Date();
  if (!m) start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end, label: start.toISOString().slice(0, 7) };
}

export const financeRouter = Router();

financeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, category, from, to, search, charged_to, payment_method, source } =
      req.query as Record<string, string | undefined>;

    const where: string[] = [];
    const params: unknown[] = [];

    if (type && type !== 'all') {
      params.push(type);
      where.push(`ft.transaction_type = $${params.length}`);
    }
    if (category && category !== 'all') {
      params.push(category);
      where.push(`ft.category = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`ft.occurred_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`ft.occurred_at <= $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`ft.description ILIKE $${params.length}`);
    }
    // 'none' filtra los movimientos que no se cargaron a nadie.
    if (charged_to === 'none') {
      where.push('ft.charged_to_staff_id IS NULL');
    } else if (charged_to && charged_to !== 'all') {
      params.push(charged_to);
      where.push(`ft.charged_to_staff_id = $${params.length}`);
    }
    // Permiten abrir una barra de la conciliación y ver qué asientos la componen.
    if (payment_method === 'none') {
      where.push('ft.payment_method IS NULL');
    } else if (payment_method && payment_method !== 'all') {
      params.push(payment_method);
      where.push(`ft.payment_method = $${params.length}`);
    }
    if (source === 'none') {
      where.push('ft.source IS NULL');
    } else if (source && source !== 'all') {
      params.push(source);
      where.push(`ft.source = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT ft.*,
              CASE
                WHEN p.id IS NULL THEN NULL
                ELSE json_build_object('id', p.id, 'full_name', p.full_name)
              END AS charged_to
       FROM financial_transactions ft
       LEFT JOIN profiles p ON p.id = ft.charged_to_staff_id
       ${whereSql}
       ORDER BY ft.occurred_at DESC
       LIMIT 5000`,
      params
    );
    res.json(rows);
  })
);

/**
 * GET /summary
 * Totales acumulados de todo el tiempo: ventas (órdenes no canceladas), ingresos y
 * gastos registrados. Independiente del mes seleccionado.
 */
financeRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const salesQ = pool.query(
      `SELECT COALESCE(SUM(total), 0)::numeric AS amount
       FROM orders WHERE status <> 'cancelled'`
    );
    const incomeQ = pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS amount
       FROM financial_transactions WHERE transaction_type = 'income'`
    );
    const expenseQ = pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS amount
       FROM financial_transactions WHERE transaction_type = 'expense'`
    );
    const [sales, income, expense] = await Promise.all([salesQ, incomeQ, expenseQ]);
    res.json({
      sales_total: Number(sales.rows[0]?.amount ?? 0),
      income_total: Number(income.rows[0]?.amount ?? 0),
      expenses_total: Number(expense.rows[0]?.amount ?? 0),
    });
  })
);

/**
 * GET /reconciliation?month=YYYY-MM
 * Conciliación mensual: por cada origen de venta (shopify/manual), ventas de las
 * órdenes vs ingresos realmente registrados. Más gastos por categoría y neto del mes.
 */
financeRouter.get(
  '/reconciliation',
  asyncHandler(async (req, res) => {
    const month = String((req.query as Record<string, string | undefined>).month ?? '');
    const { start, end, label } = monthRange(month);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // Ventas por origen de la orden.
    const salesQ = pool.query(
      `SELECT source::text AS source, COALESCE(SUM(total), 0)::numeric AS amount
       FROM orders
       WHERE status <> 'cancelled'
         AND created_at >= $1 AND created_at < $2
       GROUP BY 1`,
      [startIso, endIso]
    );
    // Ingresos registrados por canal de venta.
    const incomeQ = pool.query(
      `SELECT source AS source, COALESCE(SUM(amount), 0)::numeric AS amount
       FROM financial_transactions
       WHERE transaction_type = 'income'
         AND occurred_at >= $1 AND occurred_at < $2
       GROUP BY 1`,
      [startIso, endIso]
    );
    // Gastos del mes por categoría (desc).
    const expenseQ = pool.query(
      `SELECT category, COALESCE(SUM(amount), 0)::numeric AS amount
       FROM financial_transactions
       WHERE transaction_type = 'expense'
         AND occurred_at >= $1 AND occurred_at < $2
       GROUP BY category
       ORDER BY amount DESC`,
      [startIso, endIso]
    );

    // --- Conciliación por vía de cobro ---
    // A diferencia de by_source (que mira ventas facturadas), aquí el lado
    // "esperado" es plata YA COBRADA, que es lo que de verdad debe aparecer en
    // el libro:
    //   · COD  → la transportadora entregó, luego cobró (cod_received_at).
    //   · Prepago → el pago está verificado (payment_verified_at).
    // El diff de la barra COD es, literalmente, lo que la transportadora aún no
    // ha girado.
    const collectedQ = pool.query(
      `SELECT COALESCE(CASE WHEN is_cod THEN 'cod' ELSE payment_method END, 'sin_asignar')
                AS channel,
              COALESCE(SUM(total), 0)::numeric AS amount
         FROM orders
        WHERE status <> 'cancelled'
          AND (
            (is_cod AND cod_confirmed
              AND cod_received_at >= $1 AND cod_received_at < $2)
            OR
            (NOT is_cod AND payment_status = 'paid'
              AND COALESCE(payment_verified_at, created_at) >= $1
              AND COALESCE(payment_verified_at, created_at) < $2)
          )
        GROUP BY 1`,
      [startIso, endIso]
    );
    // Ingresos registrados por vía de cobro.
    const incomeByChannelQ = pool.query(
      `SELECT COALESCE(payment_method, 'sin_asignar') AS channel,
              COALESCE(SUM(amount), 0)::numeric AS amount
         FROM financial_transactions
        WHERE transaction_type = 'income'
          AND occurred_at >= $1 AND occurred_at < $2
        GROUP BY 1`,
      [startIso, endIso]
    );
    // --- Envíos del mes ---
    // El cliente paga el envío como línea kind='fee' dentro del total, y la
    // empresa le paga el flete a la transportadora (orders.shipping_cost). Lo
    // que importa vigilar es el neto entre ambos.
    const shippingQ = pool.query(
      `SELECT
         COALESCE((
           SELECT SUM(oi.quantity * oi.unit_price)
             FROM order_items oi
             JOIN orders o2 ON o2.id = oi.order_id
            WHERE oi.kind = 'fee'
              AND oi.external_name = ANY($3::text[])
              AND o2.status <> 'cancelled'
              AND o2.created_at >= $1 AND o2.created_at < $2
         ), 0)::numeric AS charged,
         COALESCE((
           SELECT SUM(shipping_cost) FROM orders
            WHERE status <> 'cancelled'
              AND created_at >= $1 AND created_at < $2
         ), 0)::numeric AS paid,
         COALESCE((
           SELECT COUNT(*) FROM orders
            WHERE status IN ('shipped','delivered') AND shipping_cost = 0
         ), 0)::int AS missing_cost_orders`,
      [startIso, endIso, SHIPPING_FEE_NAMES]
    );

    const [sales, income, expense, collected, incomeByChannel, shipping] =
      await Promise.all([salesQ, incomeQ, expenseQ, collectedQ, incomeByChannelQ, shippingQ]);

    const salesMap = new Map<string, number>();
    for (const r of sales.rows) salesMap.set(r.source ?? 'sin_asignar', Number(r.amount));
    const incomeMap = new Map<string, number>();
    for (const r of income.rows) incomeMap.set(r.source ?? 'sin_asignar', Number(r.amount));

    const sources = [...SALES_SOURCES] as string[];
    // Incluir bucket sin_asignar solo si tiene algún monto.
    if ((salesMap.get('sin_asignar') ?? 0) > 0 || (incomeMap.get('sin_asignar') ?? 0) > 0) {
      sources.push('sin_asignar');
    }

    const by_source = sources.map((source) => {
      const s = salesMap.get(source) ?? 0;
      const i = incomeMap.get(source) ?? 0;
      return { source, sales: s, income: i, diff: i - s };
    });

    const collectedMap = new Map<string, number>();
    for (const r of collected.rows) collectedMap.set(r.channel, Number(r.amount));
    const incomeChannelMap = new Map<string, number>();
    for (const r of incomeByChannel.rows) incomeChannelMap.set(r.channel, Number(r.amount));

    const channels = [...PAYMENT_CHANNELS] as string[];
    if ((collectedMap.get('sin_asignar') ?? 0) > 0 || (incomeChannelMap.get('sin_asignar') ?? 0) > 0) {
      channels.push('sin_asignar');
    }
    const by_payment_method = channels
      .map((channel) => {
        const c = collectedMap.get(channel) ?? 0;
        const i = incomeChannelMap.get(channel) ?? 0;
        return { channel, collected: c, income: i, diff: i - c };
      })
      .filter((r) => r.collected > 0 || r.income > 0);

    const shippingRow = shipping.rows[0] ?? {};
    const shipping_summary = {
      charged: Number(shippingRow.charged ?? 0),
      paid: Number(shippingRow.paid ?? 0),
      net: Number(shippingRow.charged ?? 0) - Number(shippingRow.paid ?? 0),
      missing_cost_orders: Number(shippingRow.missing_cost_orders ?? 0),
    };

    const expenses_by_category = expense.rows.map((r) => ({
      category: r.category as string,
      amount: Number(r.amount),
    }));

    const sales_total = by_source.reduce((a, r) => a + r.sales, 0);
    const income_total = by_source.reduce((a, r) => a + r.income, 0);
    const expenses_total = expenses_by_category.reduce((a, r) => a + r.amount, 0);

    res.json({
      month: label,
      by_source,
      by_payment_method,
      shipping: shipping_summary,
      expenses_by_category,
      sales_total,
      income_total,
      expenses_total,
      net: income_total - expenses_total,
    });
  })
);

/**
 * GET /trend?month=YYYY-MM&months=6
 * Serie histórica mes a mes (comportamiento) de ventas, ingresos y gastos,
 * terminando en `month` (inclusive) y retrocediendo `months` meses.
 */
financeRouter.get(
  '/trend',
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const { start: endMonthStart } = monthRange(String(q.month ?? ''));
    const count = Math.min(Math.max(Number(q.months) || 6, 1), 24);

    // Ventana [windowStart, windowEnd): primer día del mes más antiguo → primer día
    // del mes siguiente al seleccionado.
    const windowEnd = new Date(endMonthStart);
    windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 1);
    const windowStart = new Date(endMonthStart);
    windowStart.setUTCMonth(windowStart.getUTCMonth() - (count - 1));
    const startIso = windowStart.toISOString();
    const endIso = windowEnd.toISOString();

    const salesQ = pool.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
              COALESCE(SUM(total), 0)::numeric AS amount
       FROM orders
       WHERE status <> 'cancelled'
         AND created_at >= $1 AND created_at < $2
       GROUP BY 1`,
      [startIso, endIso]
    );
    const txQ = pool.query(
      `SELECT to_char(date_trunc('month', occurred_at), 'YYYY-MM') AS month,
              transaction_type,
              COALESCE(SUM(amount), 0)::numeric AS amount
       FROM financial_transactions
       WHERE occurred_at >= $1 AND occurred_at < $2
       GROUP BY 1, 2`,
      [startIso, endIso]
    );

    const [sales, tx] = await Promise.all([salesQ, txQ]);

    const salesMap = new Map<string, number>();
    for (const r of sales.rows) salesMap.set(r.month, Number(r.amount));
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    for (const r of tx.rows) {
      const target = r.transaction_type === 'income' ? incomeMap : expenseMap;
      target.set(r.month, Number(r.amount));
    }

    const series: { month: string; sales: number; income: number; expenses: number }[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(windowStart);
      d.setUTCMonth(d.getUTCMonth() + i);
      const key = d.toISOString().slice(0, 7);
      series.push({
        month: key,
        sales: salesMap.get(key) ?? 0,
        income: incomeMap.get(key) ?? 0,
        expenses: expenseMap.get(key) ?? 0,
      });
    }

    res.json(series);
  })
);

financeRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body as Record<string, unknown>;
    const values = INSERT_COLS.map((k) => {
      if (k === 'reference_type') return b[k] ?? 'manual';
      if (k === 'occurred_at') return b[k] ?? new Date().toISOString();
      return b[k] ?? null;
    });
    const placeholders = INSERT_COLS.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO financial_transactions (${INSERT_COLS.join(', ')})
       VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json(rows[0]);
  })
);

/**
 * PATCH /:id — campos contables solo en transacciones manuales. El campo
 * charged_to_staff_id es metadata de responsable y se permite editar también
 * en transacciones automáticas.
 */
financeRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { rows: cur } = await pool.query(
      'SELECT reference_type FROM financial_transactions WHERE id = $1',
      [id]
    );
    if (!cur[0]) return res.status(404).json({ error: 'Not found' });

    const body = req.body as Record<string, unknown>;
    const isManual = !cur[0].reference_type || cur[0].reference_type === 'manual';
    const accountingFields = ['amount', 'category', 'description'];
    const wantsAccountingChange = accountingFields.some((k) =>
      Object.prototype.hasOwnProperty.call(body, k),
    );
    if (wantsAccountingChange && !isManual) {
      return res.status(400).json({
        error:
          'Solo se pueden editar transacciones manuales. Las automáticas se gestionan desde su módulo de origen.',
      });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (isManual) {
      if (Object.prototype.hasOwnProperty.call(body, 'amount')) push('amount', body.amount);
      if (Object.prototype.hasOwnProperty.call(body, 'category')) push('category', body.category);
      if (Object.prototype.hasOwnProperty.call(body, 'description')) push('description', body.description ?? null);
      if (Object.prototype.hasOwnProperty.call(body, 'occurred_at')) push('occurred_at', body.occurred_at);
      if (Object.prototype.hasOwnProperty.call(body, 'payment_method')) push('payment_method', body.payment_method ?? null);
      if (Object.prototype.hasOwnProperty.call(body, 'source')) push('source', body.source ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'charged_to_staff_id')) {
      push('charged_to_staff_id', body.charged_to_staff_id ?? null);
    }
    if (sets.length === 0) {
      return res.json(cur[0]);
    }
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE financial_transactions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    res.json(rows[0]);
  })
);

financeRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { rows: cur } = await pool.query(
      'SELECT reference_type FROM financial_transactions WHERE id = $1',
      [id]
    );
    if (!cur[0]) return res.status(404).json({ error: 'Not found' });
    if (cur[0].reference_type && cur[0].reference_type !== 'manual') {
      return res.status(400).json({
        error:
          'Solo se pueden eliminar transacciones manuales. Las automáticas se gestionan desde su módulo de origen.',
      });
    }
    await pool.query('DELETE FROM financial_transactions WHERE id = $1', [id]);
    res.json({ ok: true });
  })
);
