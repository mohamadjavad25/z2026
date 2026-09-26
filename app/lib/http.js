import { NextResponse } from "next/server";
import { requireUser as requireUserCore } from "./auth.js";

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
