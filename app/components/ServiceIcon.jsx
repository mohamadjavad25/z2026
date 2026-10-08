import { getBeautyEmoji, guessBeautyEmojiId } from "../shared/constants/beautyEmoji";
import { ServiceEmoji } from "./ServiceEmoji";

/**
 * The one way a service's icon is shown anywhere in the app: the glossy vector
 * icon on its own -- no tile or background behind it. Uses the service's chosen `emoji` id, else
 * guesses from the name, else a generic sparkle -- so every service always
 * has an icon, including bookings that only carry the service name.
 *
 * size: "xs" | "sm" | "md" | "lg" | "xl"
 */
// [box, glyph] -- the drawings carry their own breathing room, so they fill the box.
const SIZES = { xs: [28, 28], sm: [36, 36], md: [48, 48], lg: [60, 60], xl: [76, 76] };

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
