export async function onRequest(context) {
  try {
    const result = await context.env.DB.prepare("SELECT 1 as ok").first();
    return new Response(JSON.stringify({ status: "ok", db: result?.ok ?? null }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: e?.message ?? String(e),
        hint: "DB binding missing? Pages Settings → Functions → D1 bindings → name DB (Prod + Preview).",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
