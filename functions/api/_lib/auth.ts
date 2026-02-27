import { json } from "./http";

type Env = { DB: D1Database };

const COOKIE_NAME = "dmc_nav_session";

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function pbkdf2Hash(password: string, salt: Uint8Array, iterations: number) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: (new Uint8Array(salt)).buffer, iterations },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // format: pbkdf2$<iterations>$<saltB64>$<hashB64>
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [scheme, itStr, saltB64, hashB64] = parts;
  if (scheme !== "pbkdf2") return false;

  const iterations = Number(itStr);
  if (!Number.isFinite(iterations) || iterations < 10000) return false;

  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const actual = await pbkdf2Hash(password, salt, iterations);

  // constant-time compare
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const iterations = 120000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Hash(password, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

function cookieAttrs(isSecure: boolean) {
  const attrs = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    // Secure samo na https (na localhost http bi sakrio cookie)
    ...(isSecure ? ["Secure"] : []),
  ];
  return attrs.join("; ");
}

export function setSessionCookie(sessionId: string, isSecure: boolean) {
  return `${COOKIE_NAME}=${sessionId}; ${cookieAttrs(isSecure)}`;
}

export function clearSessionCookie(isSecure: boolean) {
  return `${COOKIE_NAME}=; Max-Age=0; ${cookieAttrs(isSecure)}`;
}

export function getSessionId(req: Request): string | null {
  const cookie = req.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return m ? m[1] : null;
}

export async function requireUser(ctx: { env: Env; request: Request }) {
  const sid = getSessionId(ctx.request);
  if (!sid) return { ok: false as const, res: json({ error: "Unauthorized" }, { status: 401 }) };

  const row = await ctx.env.DB.prepare(
    `SELECT s.id as session_id, s.expires_at, u.id as user_id, u.email, u.full_name, u.is_platform_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`
  ).bind(sid).first<{
    session_id: string;
    expires_at: string;
    user_id: string;
    email: string;
    full_name: string | null;
    is_platform_admin: number;
  }>();

  if (!row) return { ok: false as const, res: json({ error: "Unauthorized" }, { status: 401 }) };

  // expiry check
  const now = Date.now();
  const exp = Date.parse(row.expires_at + "Z"); // stored as UTC-like string
  if (!Number.isFinite(exp) || exp <= now) {
    return { ok: false as const, res: json({ error: "Session expired" }, { status: 401 }) };
  }

  return {
    ok: true as const,
    user: {
      id: row.user_id,
      email: row.email,
      fullName: row.full_name,
      isPlatformAdmin: row.is_platform_admin === 1,
    },
    sessionId: row.session_id,
  };
}

export async function requirePlatformAdmin(ctx: { env: Env; request: Request }) {
  const u = await requireUser(ctx);
  if (!u.ok) return u;
  if (!u.user.isPlatformAdmin) {
    return { ok: false as const, res: json({ error: "Forbidden" }, { status: 403 }) };
  }
  return u;
}
