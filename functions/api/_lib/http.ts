export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    ...init,
  });
}

export function notFound(message = "Not Found") {
  return json({ error: message }, { status: 404 });
}

export function badRequest(message = "Bad Request") {
  return json({ error: message }, { status: 400 });
}
