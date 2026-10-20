/**
 * Salon and artist names are one per account across frfro (user's decision 2026-10-20): a salon called
 * «Frfro 🍁» blocks «frfro», «FRFRO» and any other salon or artist spelling it the same way. Clients are
 * real people and may share a name, so they are neither checked nor counted.
 *
 * Two names are "the same" when they match after: Unicode NFKC, lower case, Arabic letter forms mapped to
 * Persian (ي/ى→ی, ك→ک, ة/ۀ→ه, أ/إ/آ→ا, ؤ→و), Persian/Arabic digits to Latin, diacritics dropped, and every
 * character that is not a letter or a digit removed (spaces, ZWNJ, emoji, punctuation).
 */
export const NAME_TAKEN_MESSAGE = "این اسم را سالن یا آرتیست دیگری در فرفرو برداشته است؛ اسم دیگری انتخاب کن.";

const LETTER_MAP = { "ي": "ی", "ى": "ی", "ك": "ک", "ة": "ه", "ۀ": "ه", "أ": "ا", "إ": "ا", "آ": "ا", "ؤ": "و" };

export function nameKey(name) {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[يىكةۀأإآؤ]/g, (ch) => LETTER_MAP[ch])
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Only salons and artists hold a name of their own. */
export function hasUniqueName(type) {
  return type === "salon" || type === "artist";
}
