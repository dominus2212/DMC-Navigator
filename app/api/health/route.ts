export const runtime = "edge";

export async function GET(request: Request, env: any) {
  try {
    const result = await env.DB.prepare("SELECT 1 as ok").first();

    return new Response(
      JSON.stringify({
        status: "ok",
        db: result?.ok ?? null
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error?.message ?? String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
