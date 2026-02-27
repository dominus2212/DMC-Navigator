import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

export async function GET() {
  try {
    const ctx = getCloudflareContext() as any;
    const env = ctx?.env;

    const envKeys = env ? Object.keys(env) : [];
    const hasDB = !!env?.DB;

    if (!hasDB) {
      return Response.json(
        {
          status: "error",
          problem: "DB binding is missing (env.DB is undefined)",
          envKeys,
          hint: "Check wrangler.toml [[d1_databases]] binding = \"DB\" and redeploy with npm run deploy.",
        },
        { status: 500 }
      );
    }

    const r = await env.DB.prepare("SELECT 1 as ok").first();

    return Response.json({
      status: "ok",
      db: r?.ok ?? null,
      envKeys,
    });
  } catch (e: any) {
    return Response.json(
      {
        status: "error",
        message: e?.message ?? String(e),
        stack: e?.stack ?? null,
      },
      { status: 500 }
    );
  }
}
