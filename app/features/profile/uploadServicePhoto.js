import { createPost } from "../../shared/api/posts";
import { reportClientError } from "../../shared/lib/reportClientError";

/** After this the screen stops waiting: on a slow line (a VPN on 4G) a photo could otherwise say «sending» for ever. */
export const UPLOAD_TIMEOUT_MS = 90_000;
export const PHOTO_NOT_SENT = "عکس نرفت؛ دوباره بزن.";
export const PHOTO_TIMED_OUT = "اینترنتت کنده و عکس نرسید؛ دوباره بزن.";

/**
 * Sends one gallery photo of a service (a post outside the portfolio). Resolves to `{ post }` or `{ error }`, never
 * rejects, and every failure is reported, with the size and the wait, so it can be seen in the admin's error list.
 */
export async function uploadServicePhoto({ title, image }, { send = createPost, report = reportClientError, timeoutMs = UPLOAD_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const fail = (reason, error) => {
    const kb = Math.round((image.length * 0.75) / 1024);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    report(new Error(`sample photo not sent: ${reason}, ${kb} KB, ${seconds} s`), "handled");
    return { error };
  };
  try {
    const { ok, status, payload } = await send({ title, image, inPortfolio: false }, { signal: controller.signal });
    const post = payload?.data?.post;
    if (!ok || !post) return fail(`status ${status}`, payload?.error || PHOTO_NOT_SENT);
    return { post };
  } catch (failure) {
    if (controller.signal.aborted) return fail("timed out", PHOTO_TIMED_OUT);
    return fail(failure?.message || "network", PHOTO_NOT_SENT);
  } finally {
    clearTimeout(timer);
  }
}
