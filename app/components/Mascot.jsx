// frfro mascot: the brand character (docs/brand/CHARACTER.md), transparent webp poses in /public/brand/mascot.
// Each pose is named for what its screen tells the user (sources and prompts: docs/brand/poses/).
// Usage: <Mascot pose="connect" size={160} />  (decorative by default).
// Pass `label` only when the picture carries meaning on its own.
export const MASCOT_POSES = {
  connect: { w: 543, h: 640 },       // not connected to any salon or artist yet
  "no-bookings": { w: 629, h: 640 }, // a client with no bookings
  "free-day": { w: 508, h: 640 },    // a salon's or artist's day with no bookings
  "no-services": { w: 472, h: 640 },
  "no-portfolio": { w: 483, h: 640 },
  "saved-empty": { w: 497, h: 640 },
  lost: { w: 439, h: 640 },          // 404
  done: { w: 641, h: 640 },          // a request went through
  team: { w: 557, h: 640 }           // an artist joining a salon's team
};

export function Mascot({ pose, size = 160, label = "", className = "" }) {
  const meta = MASCOT_POSES[pose];
  if (!meta) return null;
  // `size` is the rendered height; width follows the pose's aspect ratio.
  const height = size;
  const width = Math.round((size * meta.w) / meta.h);
  return (
    <img
      className={`mascot ${className}`.trim()}
      src={`/brand/mascot/${pose}.webp`}
      width={width}
      height={height}
      alt={label}
      aria-hidden={label ? undefined : "true"}
      draggable={false}
      loading="lazy"
      decoding="async"
    />
  );
}
