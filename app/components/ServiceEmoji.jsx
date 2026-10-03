import { beautyEmojiSrc, getBeautyEmoji, guessBeautyEmojiId } from "../shared/constants/beautyEmoji";

/**
 * Vector service icon. Uses the service's chosen `emoji` id, else guesses one
 * from the name. Renders nothing when no icon matches (or `fallback` if given).
 */
export function ServiceEmoji({ id, name, size = 40, className = "", fallback = null }) {
  const resolved = getBeautyEmoji(id) ? id : guessBeautyEmojiId(name);
  const src = beautyEmojiSrc(resolved);
  if (!src) return fallback;
  return (
    <img
      className={`serviceEmoji ${className}`.trim()}
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
