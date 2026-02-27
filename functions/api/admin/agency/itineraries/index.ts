import { requireUser, requireAgencyContextBySlug, authorize } from "../../../_lib/authorize";
import { jsonError, err400 } from "../../../_lib/errors";

type Env = { DB: D1Database };

function isValidSlug(s: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

function uuid() {
  return crypto.randomUUID();
}

// GET /api/admin/agency/itineraries?agencySlug=demo-dmc&scope=mine|all
export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) {
  try {
    const req = context.request;
    const env = context.env;

    const url = new URL(req.url);
    const agencySlug = url.searchParams.get("agencySlug");
    const scope = (url.searchParams.get("scope") ?? "mine") as "mine" | "all";

    if (!agencySlug) return err400("Missing agencySlug");

    const user = await requireUser(req, env);
    const agency = await requireAgencyContextBySlug(user.id, agencySlug, env);
    await authorize(req, env, { action: "itinerary.list", agency, user });

    const canAll = agency.agencyRole === "OWNER" || agency.agencyRole === "ADMIN";
    const useAll = scope === "all" && canAll;

    const stmt = useAll
      ? env.DB.prepare(
          "SELECT id, title, slug, status, owner_user_id as ownerUserId, created_at as createdAt FROM itineraries WHERE agency_id = ? ORDER BY created_at DESC"
        ).bind(agency.agencyId)
      : env.DB.prepare(
          "SELECT id, title, slug, status, owner_user_id as ownerUserId, created_at as createdAt FROM itineraries WHERE agency_id = ? AND owner_user_id = ? ORDER BY created_at DESC"
        ).bind(agency.agencyId, user.id);

    const rows = await stmt.all();

    return new Response(JSON.stringify({ items: rows.results, scope: useAll ? "all" : "mine" }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError("INTERNAL_ERROR", e?.message ?? "Unexpected error", 500);
  }
}

// POST /api/admin/agency/itineraries
export async function onRequestPost(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) {
  try {
    const req = context.request;
    const env = context.env;

    const body = (await req.json().catch(() => null)) as null | {
      agencySlug?: string;
      title?: string;
      slug?: string;
    };

    if (!body?.agencySlug) return err400("Missing agencySlug");
    if (!body?.title || typeof body.title !== "string") return err400("Missing title");
    if (!body?.slug || typeof body.slug !== "string") return err400("Missing slug");
    if (!isValidSlug(body.slug)) return err400("Invalid slug format", { slug: "Use lowercase a-z, 0-9 and hyphens" });

    const user = await requireUser(req, env);
    const agency = await requireAgencyContextBySlug(user.id, body.agencySlug, env);
    await authorize(req, env, { action: "itinerary.create", agency, user });

    const itineraryId = uuid();
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO itineraries (id, agency_id, owner_user_id, title, slug, status, created_at) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)"
    )
      .bind(itineraryId, agency.agencyId, user.id, body.title, body.slug, now)
      .run();

    await env.DB.prepare(
      "INSERT OR IGNORE INTO itinerary_members (itinerary_id, user_id, role) VALUES (?, ?, 'OWNER')"
    )
      .bind(itineraryId, user.id)
      .run();

    return new Response(
      JSON.stringify({
        id: itineraryId,
        agencyId: agency.agencyId,
        ownerUserId: user.id,
        title: body.title,
        slug: body.slug,
        status: "DRAFT",
        createdAt: now,
      }),
      { status: 201, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError("INTERNAL_ERROR", e?.message ?? "Unexpected error", 500);
  }
}
