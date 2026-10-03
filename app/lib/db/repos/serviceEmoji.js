import { isBeautyEmojiId } from "../../../shared/constants/beautyEmoji.js";

/** Only known icon ids are persisted; anything else becomes "" (no icon). */
export function normalizeServiceEmoji(value) {
  const id = String(value || "").trim();
  return isBeautyEmojiId(id) ? id : "";
}
