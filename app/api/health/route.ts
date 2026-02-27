import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(_request: Request) {
  const ctx = getRequestContext();
  const env = (ctx as any)?.env;

  // pokaži što runtime stvarno vidi
  const envKeys = env ? Object.keys(env) : [];
  const hasDB = !!env?.DB;

  try {
    if (!env?.DB) {
      return new Response(
        JSON.stringify({
          status: "error",
          problem: "D1 binding DB is missing in env",
          envKeys,
          hint:
            "Check Cloudflare Pages project settings: Functions bindings → D1 database binding named DB (for both Production and Preview).",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await env.DB.prepare("SELECT 1 as ok").first();

    return new Response(
      JSON.stringify({ status: "ok", db: result?.ok ?? null, envKeys }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error?.message ?? String(error),
        envKeys,
        hasDB,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
