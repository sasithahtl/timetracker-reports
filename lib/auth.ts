// Lightweight HMAC-signed session token utilities (Edge compatible)
// Token format: base64url(payloadJSON).base64url(HMAC_SHA256(payloadJSON, secret))

export interface SessionPayload {
  sub: number;
  login: string;
  name: string;
  role_id?: number | null;
  iat: number; // issued at (unix seconds)
  exp: number; // expiry (unix seconds)
}

function toBase64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  // Prefer btoa in Edge/runtime with Web APIs; fallback to Buffer in Node.js
  if (typeof btoa !== 'undefined') {
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  const nodeGlobal = globalThis as unknown as { Buffer?: typeof Buffer };
  const nodeBuffer = nodeGlobal.Buffer;
  if (nodeBuffer) {
    const b64 = nodeBuffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  throw new Error('Base64 not supported in this runtime');
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

export async function createSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  const json = JSON.stringify(payload);
  const payloadB64 = toBase64Url(json);
  const signature = await hmac(json, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;
    // Convert base64url to utf-8 string
    // atob expects base64. Restore padding is not necessary for b64url we produced.
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    let json: string;
    if (typeof atob !== 'undefined') {
      json = atob(base64);
    } else {
      const nodeGlobal = globalThis as unknown as { Buffer?: typeof Buffer };
      const nodeBuffer = nodeGlobal.Buffer;
      if (nodeBuffer) {
        json = nodeBuffer.from(base64, 'base64').toString('utf8');
      } else {
        throw new Error('Base64 decode not supported in this runtime');
      }
    }
    const expectedSig = await hmac(json, secret);
    if (expectedSig !== signature) return null;
    const payload = JSON.parse(json) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || now >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || '';
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return secret;
}


