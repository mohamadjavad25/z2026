import { toIsoLikeTimestamp } from "../../shared/lib/time";

export function isWithinLastHours(timestamp, hours) {
  const isoLike = toIsoLikeTimestamp(timestamp);
  if (!isoLike) return false;
  const ms = Date.parse(isoLike);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= hours * 3600 * 1000;
}
