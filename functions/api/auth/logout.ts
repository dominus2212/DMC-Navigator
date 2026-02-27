import { json } from "../_lib/http";
import { clearSessionCookie, getSessionId } from "../_lib/auth";

type Env = { DB: D1Database };

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const isSecure = new URL(ctx.request.url).protocol === "https:";
  const sid = getSessionId(ctx.request);

  if (sid) {
    await ctx.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  }

  return json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": clearSessionCookie(isSecure),
      },
    }
  );
};
