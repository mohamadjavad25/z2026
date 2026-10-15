import { EMOJI_CATEGORIES, getBeautyEmoji, guessBeautyEmojiId } from "../constants/beautyEmoji.js";

const OTHER = { id: "other", fa: "سایر" };

/** The category a service belongs to: its icon's category, else a guess from its name, else "سایر". */
export function serviceCategoryId(service) {
  const fromIcon = getBeautyEmoji(service?.emoji)?.category;
  if (fromIcon) return fromIcon;
  const guessed = getBeautyEmoji(guessBeautyEmojiId(service?.name))?.category;
  return guessed || OTHER.id;
}

/**
 * Services split by category, in the catalog's category order ("سایر" last), each service keeping the
 * order it had. Empty categories are left out. Returns [{ id, fa, items }].
 */
export function groupServicesByCategory(services) {
  const list = Array.isArray(services) ? services : [];
  const buckets = new Map();
  for (const service of list) {
    const id = serviceCategoryId(service);
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(service);
  }
  return [...EMOJI_CATEGORIES, OTHER]
    .filter((category) => buckets.has(category.id))
    .map((category) => ({ id: category.id, fa: category.fa, items: buckets.get(category.id) }));
}
