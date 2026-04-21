import type { Request, Response, NextFunction } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Picks only allowed keys from body; drops undefined. */
export function pickBody<T extends object>(body: any, allowed: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  if (!body || typeof body !== 'object') return out as Partial<T>;
  for (const k of allowed) {
    if (k in body && body[k] !== undefined) out[k] = body[k];
  }
  return out as Partial<T>;
}

export function buildInsert(
  table: string,
  allowed: readonly string[],
  body: any
): { sql: string; params: unknown[] } {
  const picked = pickBody(body, allowed);
  const keys = Object.keys(picked);
  if (keys.length === 0) {
    throw Object.assign(new Error('No insertable fields'), { status: 400 });
  }
  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
    params: keys.map((k) => (picked as any)[k]),
  };
}

export function buildUpdate(
  table: string,
  allowed: readonly string[],
  body: any,
  id: string
): { sql: string; params: unknown[] } {
  const picked = pickBody(body, allowed);
  const keys = Object.keys(picked);
  if (keys.length === 0) {
    throw Object.assign(new Error('No updatable fields'), { status: 400 });
  }
  const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  return {
    sql: `UPDATE ${table} SET ${setSql} WHERE id = $${keys.length + 1} RETURNING *`,
    params: [...keys.map((k) => (picked as any)[k]), id],
  };
}

/** Central error handler for Express. */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err?.status ?? 500;
  const message = err?.message ?? 'Internal server error';
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({ error: message });
}
