import { json } from "../_lib/http";
import { requireUser } from "../_lib/auth";

type Env = { DB: D1Database };

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const u = await requireUser(ctx);
  if (!u.ok) return u.res;
  return json({ user: u.user });
};
