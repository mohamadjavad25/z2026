/**
 * A service name in one comparable form, for search and matching: Arabic ي/ك as Persian, no half-spaces, spaces or
 * dashes, lower case. «لاک‌ژل», «لاک ژل» and «لاک ژل» all become «لاکژل».
 */
export function normalizeServiceText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[\s‌‍‎‏\-_.،,]/g, "");
}
