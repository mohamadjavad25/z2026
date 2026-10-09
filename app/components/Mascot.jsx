// frfro mascot: transparent webp poses in /public/brand/mascot.
// Usage: <Mascot pose="search" size={160} />  (decorative by default).
// Pass `label` only when the picture carries meaning on its own.
export const MASCOT_POSES = {
  hairdryer: { w: 640, h: 559 },
  calendar: { w: 415, h: 640 },
  thumbsup: { w: 460, h: 640 },
  mirror: { w: 497, h: 640 },
  makeup: { w: 450, h: 640 },
  party: { w: 443, h: 640 },
  nails: { w: 400, h: 640 },
  search: { w: 415, h: 640 },
  scissors: { w: 449, h: 640 }
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
