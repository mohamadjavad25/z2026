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

/** Positive integer id from a route param / body field, or null when it is not one. */
export function parseId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Request body as an object, or null when it is missing / not valid JSON. */
export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/** The request's JSON body, which must be an object: malformed JSON, null, a list or a bare value all become a 400 (via withErrorHandling), never a crash further down. */
export async function readObjectBody(request) {
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SyntaxError("JSON body must be an object");
  return body;
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
    // Users read this message in the UI: only pass it through when it is already Persian
    // (zod's default messages and the "field: " prefix are English).
    const message = /[؀-ۿ]/.test(issue?.message || "") ? issue.message : "ورودی نامعتبر است؛ بررسی کن و دوباره امتحان کن.";
    return { ok: false, data: null, response: error(message, 400) };
  }
  return { ok: true, data: result.data, response: null };
}

// Postgres errors that can only come from what the caller sent: text it cannot store (NUL byte, bad JSON escape),
// a number past the column's range, text where a number belongs, a value too long for its column.
const BAD_INPUT_DB_CODES = new Set(["22001", "22003", "22007", "22008", "22021", "22023", "22P02", "22P05"]);

/** A 400 for a failure that is the caller's input (unreadable JSON body, a value the database cannot take), else null. */
export function clientErrorResponse(err) {
  if (!err) return null;
  if (err instanceof SyntaxError && /JSON/i.test(String(err.message))) return error("بدنهٔ درخواست خوانا نیست.", 400);
  if (BAD_INPUT_DB_CODES.has(err.code)) return error("ورودی نامعتبر است؛ بررسی کن و دوباره امتحان کن.", 400);
  return null;
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
      const badInput = clientErrorResponse(err);
      if (badInput) {
        logger.warn("Rejected bad input", { method: request?.method, url: request?.url, code: err.code || err.name });
        return badInput;
      }
      logger.error("Unhandled route error", {
        error: err,
        method: request?.method,
        url: request?.url
      });
      return error("خطای سرور. لطفاً دوباره امتحان کنید.", 500);
    }
  };
}
