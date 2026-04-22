/**
 * Fetch wrapper para el backend Express/Railway.
 * - baseUrl: VITE_API_URL o "/api" relativo en producción.
 * - Adjunta Authorization: Bearer <token> desde localStorage.
 * - Unifica errores: lanza Error con el mensaje del backend (o status text).
 */

export const TOKEN_STORAGE_KEY = 'beast_hub_token';

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const BASE_URL = RAW_BASE.replace(/\/$/, '');

function buildUrl(path: string, query?: Record<string, unknown>) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${BASE_URL}${normalized}`;
  if (!query) return url;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => usp.append(k, String(x)));
    else usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Record<string, unknown>; body?: unknown } = {}
): Promise<T> {
  const url = buildUrl(path, opts.query);
  const init: RequestInit = {
    method,
    headers: {
      ...authHeader(),
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  const res = await fetch(url, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const ctype = res.headers.get('content-type') ?? '';
  if (ctype.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, query?: Record<string, unknown>) =>
    request<T>('POST', path, { body, query }),
  patch: <T>(path: string, body?: unknown, query?: Record<string, unknown>) =>
    request<T>('PATCH', path, { body, query }),
  put: <T>(path: string, body?: unknown, query?: Record<string, unknown>) =>
    request<T>('PUT', path, { body, query }),
  delete: <T>(path: string, opts: { query?: Record<string, unknown>; body?: unknown } = {}) =>
    request<T>('DELETE', path, opts),
};

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}
