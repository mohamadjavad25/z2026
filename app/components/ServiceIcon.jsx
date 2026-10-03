import { getBeautyEmoji, guessBeautyEmojiId } from "../shared/constants/beautyEmoji";
import { ServiceEmoji } from "./ServiceEmoji";

/**
 * The one way a service's icon is shown anywhere in the app: the vector icon
 * on a soft category-tinted tile. Uses the service's chosen `emoji` id, else
 * guesses from the name, else a generic sparkle -- so every service always
 * has an icon, including bookings that only carry the service name.
 *
 * size: "xs" | "sm" | "md" | "lg" | "xl"
 */
const SIZES = { xs: [28, 20], sm: [36, 26], md: [48, 34], lg: [60, 44], xl: [72, 54] };

export function ServiceIcon({ emoji, name, size = "md", className = "", style }) {
  const id = getBeautyEmoji(emoji)
    ? emoji
    : guessBeautyEmojiId(name) || "sparkles";
  const category = getBeautyEmoji(id)?.category || "general";
  const [tile, glyph] = SIZES[size] || SIZES.md;
  return (
    <span
      className={`serviceIcon is-${size} cat-${category} ${className}`.trim()}
      style={{ "--svc-tile": `${tile}px`, ...style }}
      aria-hidden="true"
    >
      <ServiceEmoji id={id} size={glyph} />
    </span>
  );
}
