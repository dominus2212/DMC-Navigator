import { err401, err403, err404 } from "./errors";
import {
  Action,
  AgencyRole,
  ItineraryRole,
  AGENCY_PERMISSIONS,
  ITINERARY_PERMISSIONS,
} from "./permissions";

type Env = { DB: D1Database };

export type AuthedUser = {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
};

export type AgencyContext = {
  agencyId: string;
  agencySlug: string;
  agencyRole: AgencyRole;
};

function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

export async function requireUser(req: Request, env: Env): Promise<AuthedUser> {
  const sessionId = getCookie(req, "dmc_nav_session");
  if (!sessionId) throw err401("Missing session");

  const row = await env.DB.prepare(
    `
    SELECT u.id, u.email, u.full_name as fullName, u.is_platform_admin as isPlatformAdmin
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now')
    LIMIT 1
  `
  )
    .bind(sessionId)
    .first<{
      id: string;
      email: string;
      fullName: string;
      isPlatformAdmin: number;
    }>();

  if (!row) throw err401("Invalid or expired session");

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    isPlatformAdmin: row.isPlatformAdmin === 1,
  };
}

export async function requireAgencyContextBySlug(
  userId: string,
  agencySlug: string,
  env: Env
): Promise<AgencyContext> {
  const row = await env.DB.prepare(
    `
    SELECT a.id as agencyId, a.slug as agencySlug, am.role as agencyRole
    FROM agencies a
    JOIN agency_members am ON am.agency_id = a.id
    WHERE a.slug = ? AND am.user_id = ?
    LIMIT 1
  `
  )
    .bind(agencySlug, userId)
    .first<{ agencyId: string; agencySlug: string; agencyRole: AgencyRole }>();

  if (!row) throw err404("Agency not found");

  return { agencyId: row.agencyId, agencySlug: row.agencySlug, agencyRole: row.agencyRole };
}

export async function getEffectiveItineraryRole(
  userId: string,
  agency: AgencyContext,
  itineraryId: string,
  env: Env
): Promise<ItineraryRole | null> {
  const it = await env.DB.prepare(
    `SELECT id, agency_id as agencyId, owner_user_id as ownerUserId
     FROM itineraries
     WHERE id = ?
     LIMIT 1`
  )
    .bind(itineraryId)
    .first<{ id: string; agencyId: string; ownerUserId: string }>();

  if (!it) return null;
  if (it.agencyId !== agency.agencyId) return null;

  if (agency.agencyRole === "OWNER") return "OWNER";
  if (agency.agencyRole === "ADMIN") return "EDITOR";
  if (agency.agencyRole === "AGENT" && it.ownerUserId === userId) return "OWNER";

  const mem = await env.DB.prepare(
    `SELECT role FROM itinerary_members WHERE itinerary_id = ? AND user_id = ? LIMIT 1`
  )
    .bind(itineraryId, userId)
    .first<{ role: ItineraryRole }>();

  return mem?.role ?? null;
}

export async function authorize(
  req: Request,
  env: Env,
  params: {
    action: Action;
    agency: AgencyContext;
    user: AuthedUser;
    itineraryId?: string;
  }
): Promise<{ itineraryRole?: ItineraryRole }> {
  const { action, agency, user, itineraryId } = params;

  const allowedAgencyRoles = AGENCY_PERMISSIONS[action] ?? [];
  if (!allowedAgencyRoles.includes(agency.agencyRole)) throw err403("Forbidden");

  const requiredItRole = ITINERARY_PERMISSIONS[action];
  if (requiredItRole && itineraryId) {
    const role = await getEffectiveItineraryRole(user.id, agency, itineraryId, env);
    if (!role) throw err404("Itinerary not found");
    if (!requiredItRole.includes(role)) throw err403("Forbidden");
    return { itineraryRole: role };
  }

  return {};
}
