export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return new Response(
    JSON.stringify({ error: { code, message, ...(extra ?? {}) } }),
    {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }
  );
}

export const err401 = (msg = "Not authenticated") =>
  jsonError("UNAUTHENTICATED", msg, 401);

export const err403 = (msg = "Forbidden") => jsonError("FORBIDDEN", msg, 403);

export const err404 = (msg = "Not found") => jsonError("NOT_FOUND", msg, 404);

export const err400 = (msg = "Validation error", fields?: Record<string, unknown>) =>
  jsonError("VALIDATION_ERROR", msg, 400, fields ? { fields } : undefined);
