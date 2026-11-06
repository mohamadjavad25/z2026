import { error, json, notFound, requireUser, withErrorHandling, readObjectBody } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { ownerServiceLinks, setServicePhotos } from "../../lib/db/repos/servicePhotos.js";

export const runtime = "nodejs";

const KIND_BY_ROLE = { artist: "artist", salon: "salon" };

/**
 * GET: what the post composer needs, the caller's own services ({ id, name, photoCount, photoAsCover }) and which
 * services each of their posts is linked to ({ [postId]: [serviceId] }).
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!KIND_BY_ROLE[auth.user.type]) return error("این بخش مال سالن‌ها و آرتیست‌هاست.", 403);
  return json({ data: await ownerServiceLinks(auth.user.id, auth.user.type) });
}

/**
 * PUT { serviceId, postIds, photoAsCover? } : the sample photos of one of the caller's own services. `postIds` are
 * the caller's own public portfolio posts, in order (the first is the cover, at most three). An empty list takes
 * every photo off. `photoAsCover` says whether the photos replace the service's icon in lists (true) or the icon
 * stays and only a small photo button shows (false).
 */
async function _PUT(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const kind = KIND_BY_ROLE[auth.user.type];
  if (!kind) return error("این بخش مال سالن‌ها و آرتیست‌هاست.", 403);
  const body = await readObjectBody(request);
  const serviceId = Number(body.serviceId);
  if (!Number.isInteger(serviceId) || serviceId <= 0) return error("خدمت رو انتخاب کن.", 400);
  if (!Array.isArray(body.postIds)) return error("عکس‌ها درست نرسید؛ دوباره بزن.", 400);
  const saved = await setServicePhotos(kind, auth.user.id, serviceId, body.postIds, typeof body.photoAsCover === "boolean" ? { asCover: body.photoAsCover } : {});
  if (!saved) return notFound();
  return json({ data: { postIds: saved } });
}

export const GET = withErrorHandling(_GET);
export const PUT = withErrorHandling(_PUT);
