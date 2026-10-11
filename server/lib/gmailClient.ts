// Cliente mínimo de la Gmail API (scope gmail.readonly) con fetch nativo.
// Credenciales OAuth por env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
// GMAIL_REFRESH_TOKEN (se obtiene una vez con scripts/gmail-auth.mjs).

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (!isGmailConfigured()) {
    throw Object.assign(
      new Error('Gmail no configurado: faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN.'),
      { status: 400 }
    );
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    // invalid_grant = refresh token revocado o vencido (app en modo "Testing").
    throw Object.assign(
      new Error(`Gmail OAuth falló: ${body.error ?? res.status} ${body.error_description ?? ''}`.trim()),
      { status: 502 }
    );
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function gmailGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getAccessToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GMAIL_API}/${path}${qs ? '?' + qs : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Gmail API error ${res.status}${text ? ' — ' + text.slice(0, 200) : ''}`),
      { status: 502 }
    );
  }
  return (await res.json()) as T;
}

/** IDs de los mensajes que cumplen la búsqueda (sintaxis del buscador de Gmail). */
export async function listMessageIds(query: string, max = 500): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = { q: query, maxResults: '100' };
    if (pageToken) params.pageToken = pageToken;
    const body = await gmailGet<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
      'messages',
      params
    );
    for (const m of body.messages ?? []) ids.push(m.id);
    pageToken = body.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  receivedAt: string | null;
  subject: string | null;
  /** Cuerpos text/html y text/plain ya decodificados (la API quita el transfer-encoding). */
  bodies: string[];
}

function collectBodies(part: GmailPart | undefined, out: string[]): void {
  if (!part) return;
  if (part.body?.data && /^text\/(html|plain)/i.test(part.mimeType ?? '')) {
    out.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
  }
  for (const p of part.parts ?? []) collectBodies(p, out);
}

export async function getMessage(id: string): Promise<GmailMessage> {
  const msg = await gmailGet<{
    id: string;
    internalDate?: string;
    payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
  }>(`messages/${encodeURIComponent(id)}`, { format: 'full' });
  const bodies: string[] = [];
  collectBodies(msg.payload, bodies);
  const subject =
    msg.payload?.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value ?? null;
  return {
    id: msg.id,
    receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
    subject,
    bodies,
  };
}
