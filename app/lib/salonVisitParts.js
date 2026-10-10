import { parseServiceDurationMinutes } from "../shared/lib/time.js";

/**
 * The services of one multi-service visit as booking parts. Each service's length comes from
 * the salon's own service list (the request's value only for a service the salon no longer
 * lists), and only the salon itself may name the artists -- a client's request is split by
 * the server's draft.
 */
export function salonVisitParts(salon, parts, { allowStaff = false } = {}) {
  return (Array.isArray(parts) ? parts : []).map((part) => {
    const service = String(part?.service || "").trim();
    const listed = Array.isArray(salon?.services)
      ? salon.services.find((item) => String(item?.name || "").trim() === service)
      : null;
    return {
      service,
      listed: Boolean(listed),
      minutes: listed?.duration
        ? parseServiceDurationMinutes(listed.duration)
        : Math.max(15, Number(part?.durationMinutes) || parseServiceDurationMinutes(part?.duration)),
      staff: allowStaff ? String(part?.staff || "").trim() : ""
    };
  });
}
