/**
 * Throttles that decide whether real visitors get in on a busy day, kept in one place and each
 * overridable from the env file without a code change.
 *
 * Per address: Iranian mobile networks put many phones behind one public address (carrier NAT), so
 * a per-address limit counts a whole neighbourhood, not one person. These only stop one source from
 * going through many phones; the per-phone limits (login, codes) stay strict and are the real guard
 * against password and code guessing.
 */
function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** New accounts per address per hour. */
export const REGISTER_PER_IP_HOUR = envNumber("FRFRO_REGISTER_PER_IP_HOUR", 60);
/** Login attempts per address per 15 minutes. */
export const LOGIN_PER_IP_15MIN = envNumber("FRFRO_LOGIN_PER_IP_15MIN", 100);
/** A guest asking the free days of a salon, per address per minute (each ask is up to 14 days, shared through a short cache). */
export const AVAILABILITY_DAYS_GUEST_PER_IP_MIN = envNumber("FRFRO_AVAILABILITY_DAYS_PER_IP_MIN", 300);
/** Taps counted on the /go page, per address per minute. */
export const LANDING_VISIT_PER_IP_MIN = envNumber("FRFRO_LANDING_VISIT_PER_IP_MIN", 300);
/** SMS code requests per address per hour. */
export const OTP_SEND_PER_IP_HOUR = envNumber("FRFRO_OTP_SEND_PER_IP_HOUR", 40);
/** SMS code checks per address per 15 minutes. */
export const OTP_VERIFY_PER_IP_15MIN = envNumber("FRFRO_OTP_VERIFY_PER_IP_15MIN", 100);
/**
 * SMS codes for the whole site per hour: a ceiling on what an abuser can cost in SMS credit. It was
 * 200, which a launch-day crowd would reach and then nobody could sign up; set it to what the SMS
 * budget allows.
 */
export const OTP_SEND_SITE_HOUR = envNumber("FRFRO_OTP_PER_HOUR", 1500);
