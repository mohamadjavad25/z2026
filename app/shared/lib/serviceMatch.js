/**
 * Two salons name the same service in their own words, but mostly the same words: «کوتاهی مو» and
 * «کوتاهی  مو», «كوتاهي مو» typed on an Arabic keyboard, or with a half-space. This key ignores
 * only those differences (spacing, half-spaces, Arabic ي/ك, digit script, case), never the words,
 * so a backup salon is offered only when it really lists the services the client picked.
 */
export function serviceNameKey(name) {
  return String(name || "")
    .replace(/[‌‍‎‏]/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
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
