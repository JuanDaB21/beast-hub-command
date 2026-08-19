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
];

const PAYMENT_METHODS = ['fisico', 'nequi', 'daviplata', 'bancolombia', 'cod'] as const;

export const financeRouter = Router();

financeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, category, from, to, search } = req.query as Record<string, string | undefined>;

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
 * GET /reconciliation?month=YYYY-MM
 * Conciliación mensual: por cada método de pago, ventas de las órdenes vs
 * ingresos realmente registrados. Más gastos totales y neto del mes.
 */
financeRouter.get(
  '/reconciliation',
  asyncHandler(async (req, res) => {
    const month = String((req.query as Record<string, string | undefined>).month ?? '').trim();
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    const start = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) : new Date();
    if (!m) start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // Ventas por canal (COD tiene prioridad sobre payment_method).
    const salesQ = pool.query(
      `SELECT CASE WHEN is_cod THEN 'cod' ELSE payment_method END AS method,
              COALESCE(SUM(total), 0)::numeric AS amount
       FROM orders
       WHERE status <> 'cancelled'
         AND created_at >= $1 AND created_at < $2
       GROUP BY 1`,
      [startIso, endIso]
    );
    // Ingresos registrados por método de pago.
    const incomeQ = pool.query(
      `SELECT payment_method AS method, COALESCE(SUM(amount), 0)::numeric AS amount
       FROM financial_transactions
       WHERE transaction_type = 'income'
         AND occurred_at >= $1 AND occurred_at < $2
       GROUP BY 1`,
      [startIso, endIso]
    );
    // Gastos totales del mes.
    const expenseQ = pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS amount
       FROM financial_transactions
       WHERE transaction_type = 'expense'
         AND occurred_at >= $1 AND occurred_at < $2`,
      [startIso, endIso]
    );

    const [sales, income, expense] = await Promise.all([salesQ, incomeQ, expenseQ]);

    const salesMap = new Map<string, number>();
    for (const r of sales.rows) salesMap.set(r.method ?? 'sin_asignar', Number(r.amount));
    const incomeMap = new Map<string, number>();
    for (const r of income.rows) incomeMap.set(r.method ?? 'sin_asignar', Number(r.amount));

    const methods = [...PAYMENT_METHODS];
    // Incluir bucket sin_asignar solo si tiene algún monto.
    if ((salesMap.get('sin_asignar') ?? 0) > 0 || (incomeMap.get('sin_asignar') ?? 0) > 0) {
      methods.push('sin_asignar' as (typeof PAYMENT_METHODS)[number]);
    }

    const by_method = methods.map((method) => {
      const s = salesMap.get(method) ?? 0;
      const i = incomeMap.get(method) ?? 0;
      return { method, sales: s, income: i, diff: i - s };
    });

    const sales_total = by_method.reduce((a, r) => a + r.sales, 0);
    const income_total = by_method.reduce((a, r) => a + r.income, 0);
    const expenses_total = Number(expense.rows[0]?.amount ?? 0);

    res.json({
      month: m ? month : startIso.slice(0, 7),
      by_method,
      sales_total,
      income_total,
      expenses_total,
      net: income_total - expenses_total,
    });
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
