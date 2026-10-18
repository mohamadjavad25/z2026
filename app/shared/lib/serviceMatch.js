/**
 * Most services are added from the shared catalog (shared/constants/serviceCatalog.js), so two salons
 * usually carry the very same name. What still differs is typing: «کوتاهی  مو», «كوتاهي مو» from an
 * Arabic keyboard, a half-space, «براشینگ و سشوار» / «براشینگ-سشوار» / «براشینگ، سشوار». This key
 * ignores only those (spacing, half-spaces, Arabic letters, digit script, punctuation, a joining «و»,
 * case), never the words: a backup is offered only when it really does the same service, because
 * sending the client to the wrong service is worse than offering no backup (decision 2026-10-18).
 */
export function serviceNameKey(name) {
  return String(name || "")
    .replace(/[\u200c\u200d\u200e\u200f]/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/ـ/g, "")
    .replace(/[\-–—_/\\،,.;:؛!?؟()[\]{}«»"'+&|]/g, " ")
    .replace(/(^|\s)و(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The salon's own name for each of `names`, in the same order, or null when it lacks any of them.
 * `services` is the salon's service list (objects with `name`).
 */
export function matchServiceNames(services, names) {
  const byKey = new Map();
  for (const item of Array.isArray(services) ? services : []) {
    const name = String(item?.name || "").trim();
    if (name && !byKey.has(serviceNameKey(name))) byKey.set(serviceNameKey(name), name);
  }
  const out = [];
  for (const name of names) {
    const own = byKey.get(serviceNameKey(name));
    if (!own) return null;
    out.push(own);
  }
  return out.length ? out : null;
}
