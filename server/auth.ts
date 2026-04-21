import { Router, Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set');
}
const JWT_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) ?? '7d';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function sign(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET as string, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

async function loadUser(id: string): Promise<AuthUser | null> {
  const { rows } = await pool.query(
    'SELECT id, email, name, role FROM users WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload & {
      sub?: string;
      email?: string;
      role?: string;
    };
    if (!decoded.sub) return res.status(401).json({ error: 'Unauthorized' });
    req.user = {
      id: decoded.sub,
      email: decoded.email ?? '',
      name: null,
      role: decoded.role ?? 'staff',
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email y password son requeridos' });
  }

  const { rows } = await pool.query(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  const token = sign(authUser);
  res.json({ token, user: authUser });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await loadUser(req.user!.id);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  // Stateless JWT: client simply drops the token.
  res.json({ ok: true });
});
