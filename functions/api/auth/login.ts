import { json, badRequest } from "../_lib/http";
import { setSessionCookie, verifyPassword } from "../_lib/auth";

type Env = { DB: D1Database };

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const isSecure = new URL(ctx.request.url).protocol === "https:";

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) return badRequest("Email and password required");

  const user = await ctx.env.DB
    .prepare("SELECT id, email, full_name, password_hash, is_platform_admin FROM users WHERE email = ?")
    .bind(email)
    .first<{
      id: string;
      email: string;
      full_name: string | null;
      password_hash: string | null;
      is_platform_admin: number;
    }>();

  if (!user || !user.password_hash) {
    return json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return json({ error: "Invalid credentials" }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dana

  await ctx.env.DB
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, user.id, expiresAt.toISOString().slice(0, 19).replace("T", " "))
    .run();

  return json(
    {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isPlatformAdmin: user.is_platform_admin === 1,
      },
    },
    {
      status: 200,
      headers: {
        "Set-Cookie": setSessionCookie(sessionId, isSecure),
      },
    }
  );
};
