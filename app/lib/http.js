import { NextResponse } from "next/server";
import { requireUser as requireUserCore } from "./auth.js";
import { logger } from "./logger.js";

export function json(data, init) {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  return NextResponse.json(data, { ...init, headers });
}

export function error(message, status = 400) {
  return json({ error: message }, { status });
}

export function notFound(message = "یافت نشد.") {
  return error(message, 404);
}

export async function requireUser(request) {
  const result = await requireUserCore(request);
  if (!result.ok) {
    return {
      ok: false,
      user: null,
      response: error("ورود لازم است.", 401)
    };
  }
  return result;
}

export function requireRole(user, role, message = "دسترسی غیرمجاز.") {
  if (user.type !== role) return error(message, 403);
  return null;
}

export async function requireUserRole(request, role, message) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const forbidden = requireRole(auth.user, role, message);
  if (forbidden) return { ok: false, user: auth.user, response: forbidden };
  return auth;
}

/** Validates `body` against a zod `schema`. On failure returns a 400 whose
 *  message is the first validation issue, in the same `{ ok, response }`
 *  shape as requireUser/requireUserRole so route code reads the same way:
 *  `const v = validateBody(schema, body); if (!v.ok) return v.response;`.
 *  On success, `v.data` is the parsed (and any zod-coerced/defaulted)
 *  value -- routes should use it instead of the raw body from here on. */
export function validateBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return { ok: false, data: null, response: error(`${path}${issue?.message || "ورودی نامعتبر است."}`, 400) };
  }
  return { ok: true, data: result.data, response: null };
}

/**
 * Wraps a route handler (GET/POST/PATCH/DELETE) so an unexpected thrown
 * error (a DB constraint violation, a dropped connection, a bug) returns
 * this app's own JSON error shape instead of Next.js's generic unhandled-
 * exception response -- and gets logged with the route/method that threw,
 * instead of a bare `console.error` with no context. Forwards every
 * argument (request, and { params } for dynamic routes) unchanged.
 * Route-level `try/catch` for an *expected* failure the route wants to
 * turn into a specific error message/status is unaffected -- this only
 * catches what would otherwise propagate uncaught.
 */
export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      const request = args[0];
      logger.error("Unhandled route error", {
        error: err,
        method: request?.method,
        url: request?.url
      });
      return error("خطای سرور. لطفاً دوباره امتحان کنید.", 500);
    }
  };
}
