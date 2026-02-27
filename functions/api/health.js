export async function onRequest(context) {
  try {
    // D1 binding dostupan kao context.env.DB (ako je ispravno bindan u Pages)
    const result = await context.env.DB.prepare("SELECT 1 as ok").first();

    return new Response(JSON.stringify({ status: "ok", db: result?.ok ?? null }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: e?.message ?? String(e),
        hint: "If DB is undefined, add D1 binding named DB in Pages Settings → Functions → D1 bindings (Production + Preview).",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
