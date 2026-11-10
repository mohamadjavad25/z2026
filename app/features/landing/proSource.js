/**
 * The counter tag for a visit to /s (the SMS page for salon owners and artists): "/s/a" → "sms-a", "/s" → "sms".
 * Only letters, digits, "-" and "_" survive, as in the counter itself (landingVisits.js), so two texts sent with
 * frfro.ir/s/a and frfro.ir/s/b can be told apart.
 */
export function proSourceTag(pathname) {
  const part = String(pathname || "").split("/").filter(Boolean)[1] || "";
  const clean = part.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
  return clean ? `sms-${clean}` : "sms";
}
