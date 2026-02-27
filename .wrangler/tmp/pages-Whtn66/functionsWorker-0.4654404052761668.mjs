var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_lib/errors.ts
function jsonError(code, message, status, extra) {
  return new Response(
    JSON.stringify({ error: { code, message, ...extra ?? {} } }),
    {
      status,
      headers: { "content-type": "application/json; charset=utf-8" }
    }
  );
}
__name(jsonError, "jsonError");
var err401 = /* @__PURE__ */ __name((msg = "Not authenticated") => jsonError("UNAUTHENTICATED", msg, 401), "err401");
var err403 = /* @__PURE__ */ __name((msg = "Forbidden") => jsonError("FORBIDDEN", msg, 403), "err403");
var err404 = /* @__PURE__ */ __name((msg = "Not found") => jsonError("NOT_FOUND", msg, 404), "err404");
var err400 = /* @__PURE__ */ __name((msg = "Validation error", fields) => jsonError("VALIDATION_ERROR", msg, 400, fields ? { fields } : void 0), "err400");

// api/_lib/permissions.ts
var AGENCY_PERMISSIONS = {
  "agency.users.create": ["OWNER", "ADMIN"],
  "agency.users.list": ["OWNER", "ADMIN"],
  "agency.users.update": ["OWNER"],
  "itinerary.create": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.list": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.read": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.update": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.publish": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.archive": ["OWNER", "ADMIN"],
  "page.create": ["OWNER", "ADMIN", "AGENT"],
  "page.list": ["OWNER", "ADMIN", "AGENT"],
  "page.update": ["OWNER", "ADMIN", "AGENT"],
  "page.reorder": ["OWNER", "ADMIN", "AGENT"],
  "page.publish": ["OWNER", "ADMIN", "AGENT"]
};
var ITINERARY_PERMISSIONS = {
  "itinerary.update": ["OWNER", "EDITOR"],
  "itinerary.publish": ["OWNER"],
  "itinerary.archive": ["OWNER"],
  "page.create": ["OWNER", "EDITOR"],
  "page.update": ["OWNER", "EDITOR"],
  "page.reorder": ["OWNER", "EDITOR"],
  "page.publish": ["OWNER"]
};

// api/_lib/authorize.ts
function getCookie(req, name) {
  const raw = req.headers.get("cookie") ?? "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}
__name(getCookie, "getCookie");
async function requireUser(req, env) {
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
  ).bind(sessionId).first();
  if (!row) throw err401("Invalid or expired session");
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    isPlatformAdmin: row.isPlatformAdmin === 1
  };
}
__name(requireUser, "requireUser");
async function requireAgencyContextBySlug(userId, agencySlug, env) {
  const row = await env.DB.prepare(
    `
    SELECT a.id as agencyId, a.slug as agencySlug, am.role as agencyRole
    FROM agencies a
    JOIN agency_members am ON am.agency_id = a.id
    WHERE a.slug = ? AND am.user_id = ?
    LIMIT 1
  `
  ).bind(agencySlug, userId).first();
  if (!row) throw err404("Agency not found");
  return { agencyId: row.agencyId, agencySlug: row.agencySlug, agencyRole: row.agencyRole };
}
__name(requireAgencyContextBySlug, "requireAgencyContextBySlug");
async function getEffectiveItineraryRole(userId, agency, itineraryId, env) {
  const it = await env.DB.prepare(
    `SELECT id, agency_id as agencyId, owner_user_id as ownerUserId
     FROM itineraries
     WHERE id = ?
     LIMIT 1`
  ).bind(itineraryId).first();
  if (!it) return null;
  if (it.agencyId !== agency.agencyId) return null;
  if (agency.agencyRole === "OWNER") return "OWNER";
  if (agency.agencyRole === "ADMIN") return "EDITOR";
  if (agency.agencyRole === "AGENT" && it.ownerUserId === userId) return "OWNER";
  const mem = await env.DB.prepare(
    `SELECT role FROM itinerary_members WHERE itinerary_id = ? AND user_id = ? LIMIT 1`
  ).bind(itineraryId, userId).first();
  return mem?.role ?? null;
}
__name(getEffectiveItineraryRole, "getEffectiveItineraryRole");
async function authorize(req, env, params) {
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
__name(authorize, "authorize");

// api/admin/agency/itineraries/index.ts
function isValidSlug(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}
__name(isValidSlug, "isValidSlug");
function uuid() {
  return crypto.randomUUID();
}
__name(uuid, "uuid");
async function onRequestGet(context) {
  try {
    const req = context.request;
    const env = context.env;
    const url = new URL(req.url);
    const agencySlug = url.searchParams.get("agencySlug");
    const scope = url.searchParams.get("scope") ?? "mine";
    if (!agencySlug) return err400("Missing agencySlug");
    const user = await requireUser(req, env);
    const agency = await requireAgencyContextBySlug(user.id, agencySlug, env);
    await authorize(req, env, { action: "itinerary.list", agency, user });
    const canAll = agency.agencyRole === "OWNER" || agency.agencyRole === "ADMIN";
    const useAll = scope === "all" && canAll;
    const stmt = useAll ? env.DB.prepare(
      "SELECT id, title, slug, status, owner_user_id as ownerUserId, created_at as createdAt FROM itineraries WHERE agency_id = ? ORDER BY created_at DESC"
    ).bind(agency.agencyId) : env.DB.prepare(
      "SELECT id, title, slug, status, owner_user_id as ownerUserId, created_at as createdAt FROM itineraries WHERE agency_id = ? AND owner_user_id = ? ORDER BY created_at DESC"
    ).bind(agency.agencyId, user.id);
    const rows = await stmt.all();
    return new Response(JSON.stringify({ items: rows.results, scope: useAll ? "all" : "mine" }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonError("INTERNAL_ERROR", e?.message ?? "Unexpected error", 500);
  }
}
__name(onRequestGet, "onRequestGet");
async function onRequestPost(context) {
  try {
    const req = context.request;
    const env = context.env;
    const body = await req.json().catch(() => null);
    if (!body?.agencySlug) return err400("Missing agencySlug");
    if (!body?.title || typeof body.title !== "string") return err400("Missing title");
    if (!body?.slug || typeof body.slug !== "string") return err400("Missing slug");
    if (!isValidSlug(body.slug)) return err400("Invalid slug format", { slug: "Use lowercase a-z, 0-9 and hyphens" });
    const user = await requireUser(req, env);
    const agency = await requireAgencyContextBySlug(user.id, body.agencySlug, env);
    await authorize(req, env, { action: "itinerary.create", agency, user });
    const itineraryId = uuid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(
      "INSERT INTO itineraries (id, agency_id, owner_user_id, title, slug, status, created_at) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)"
    ).bind(itineraryId, agency.agencyId, user.id, body.title, body.slug, now).run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO itinerary_members (itinerary_id, user_id, role) VALUES (?, ?, 'OWNER')"
    ).bind(itineraryId, user.id).run();
    return new Response(
      JSON.stringify({
        id: itineraryId,
        agencyId: agency.agencyId,
        ownerUserId: user.id,
        title: body.title,
        slug: body.slug,
        status: "DRAFT",
        createdAt: now
      }),
      { status: 201, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonError("INTERNAL_ERROR", e?.message ?? "Unexpected error", 500);
  }
}
__name(onRequestPost, "onRequestPost");

// api/admin/agency/ping.ts
async function onRequestGet2() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(onRequestGet2, "onRequestGet");

// api/_lib/http.ts
function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    },
    ...init
  });
}
__name(json, "json");
function notFound(message = "Not Found") {
  return json({ error: message }, { status: 404 });
}
__name(notFound, "notFound");
function badRequest(message = "Bad Request") {
  return json({ error: message }, { status: 400 });
}
__name(badRequest, "badRequest");

// api/public/[agencySlug]/[itinerarySlug].ts
var onRequestGet3 = /* @__PURE__ */ __name(async (ctx) => {
  const { agencySlug, itinerarySlug } = ctx.params;
  const agency = await ctx.env.DB.prepare("SELECT id FROM agencies WHERE slug = ?").bind(agencySlug).first();
  if (!agency) {
    return notFound("Agency not found");
  }
  const itinerary = await ctx.env.DB.prepare(
    "SELECT id, title, description, status FROM itineraries WHERE slug = ? AND agency_id = ?"
  ).bind(itinerarySlug, agency.id).first();
  if (!itinerary) {
    return notFound("Itinerary not found");
  }
  const dropdowns = await ctx.env.DB.prepare("SELECT id, name FROM dropdowns WHERE itinerary_id = ?").bind(itinerary.id).all();
  const result = [];
  for (const dd of dropdowns.results) {
    const items = await ctx.env.DB.prepare(
      "SELECT id, label, value, sort_order FROM dropdown_items WHERE dropdown_id = ? AND active = 1 ORDER BY sort_order ASC"
    ).bind(dd.id).all();
    result.push({
      ...dd,
      items: items.results
    });
  }
  return json({
    itinerary,
    dropdowns: result
  });
}, "onRequestGet");

// api/_lib/auth.ts
var COOKIE_NAME = "dmc_nav_session";
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
__name(base64ToBytes, "base64ToBytes");
async function pbkdf2Hash(password, salt, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt).buffer, iterations },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}
__name(pbkdf2Hash, "pbkdf2Hash");
async function verifyPassword(password, stored) {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [scheme, itStr, saltB64, hashB64] = parts;
  if (scheme !== "pbkdf2") return false;
  const iterations = Number(itStr);
  if (!Number.isFinite(iterations) || iterations < 1e4) return false;
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const actual = await pbkdf2Hash(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
__name(verifyPassword, "verifyPassword");
function cookieAttrs(isSecure) {
  const attrs = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    // Secure samo na https (na localhost http bi sakrio cookie)
    ...isSecure ? ["Secure"] : []
  ];
  return attrs.join("; ");
}
__name(cookieAttrs, "cookieAttrs");
function setSessionCookie(sessionId, isSecure) {
  return `${COOKIE_NAME}=${sessionId}; ${cookieAttrs(isSecure)}`;
}
__name(setSessionCookie, "setSessionCookie");
function clearSessionCookie(isSecure) {
  return `${COOKIE_NAME}=; Max-Age=0; ${cookieAttrs(isSecure)}`;
}
__name(clearSessionCookie, "clearSessionCookie");
function getSessionId(req) {
  const cookie = req.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return m ? m[1] : null;
}
__name(getSessionId, "getSessionId");
async function requireUser2(ctx) {
  const sid = getSessionId(ctx.request);
  if (!sid) return { ok: false, res: json({ error: "Unauthorized" }, { status: 401 }) };
  const row = await ctx.env.DB.prepare(
    `SELECT s.id as session_id, s.expires_at, u.id as user_id, u.email, u.full_name, u.is_platform_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`
  ).bind(sid).first();
  if (!row) return { ok: false, res: json({ error: "Unauthorized" }, { status: 401 }) };
  const now = Date.now();
  const exp = Date.parse(row.expires_at + "Z");
  if (!Number.isFinite(exp) || exp <= now) {
    return { ok: false, res: json({ error: "Session expired" }, { status: 401 }) };
  }
  return {
    ok: true,
    user: {
      id: row.user_id,
      email: row.email,
      fullName: row.full_name,
      isPlatformAdmin: row.is_platform_admin === 1
    },
    sessionId: row.session_id
  };
}
__name(requireUser2, "requireUser");

// api/auth/login.ts
var onRequestPost2 = /* @__PURE__ */ __name(async (ctx) => {
  const isSecure = new URL(ctx.request.url).protocol === "https:";
  let body;
  try {
    body = await ctx.request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email || !password) return badRequest("Email and password required");
  const user = await ctx.env.DB.prepare("SELECT id, email, full_name, password_hash, is_platform_admin FROM users WHERE email = ?").bind(email).first();
  if (!user || !user.password_hash) {
    return json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return json({ error: "Invalid credentials" }, { status: 401 });
  }
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
  await ctx.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(sessionId, user.id, expiresAt.toISOString().slice(0, 19).replace("T", " ")).run();
  return json(
    {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isPlatformAdmin: user.is_platform_admin === 1
      }
    },
    {
      status: 200,
      headers: {
        "Set-Cookie": setSessionCookie(sessionId, isSecure)
      }
    }
  );
}, "onRequestPost");

// api/auth/logout.ts
var onRequestPost3 = /* @__PURE__ */ __name(async (ctx) => {
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
        "Set-Cookie": clearSessionCookie(isSecure)
      }
    }
  );
}, "onRequestPost");

// api/auth/me.ts
var onRequestGet4 = /* @__PURE__ */ __name(async (ctx) => {
  const u = await requireUser2(ctx);
  if (!u.ok) return u.res;
  return json({ user: u.user });
}, "onRequestGet");

// ../.wrangler/tmp/pages-Whtn66/functionsRoutes-0.9179985226725877.mjs
var routes = [
  {
    routePath: "/api/admin/agency/itineraries",
    mountPath: "/api/admin/agency/itineraries",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/agency/itineraries",
    mountPath: "/api/admin/agency/itineraries",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/agency/ping",
    mountPath: "/api/admin/agency",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/public/:agencySlug/:itinerarySlug",
    mountPath: "/api/public/:agencySlug",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  }
];

// ../../../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError2;

// ../.wrangler/tmp/bundle-llltmz/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-llltmz/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.4654404052761668.mjs.map
