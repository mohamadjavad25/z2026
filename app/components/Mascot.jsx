// The frfro mascot: a round ball of woolly black fur with two white
// eyes. Drawn on a 100-unit grid, flat colour only (no gradients, outlines or
// shadows). The body is one union of circles, so every tuft ends in a soft
// curve. Every state is derived from the same two eye anchors (EYE_X, EYE_Y),
// so the family stays consistent at any size.
//
// Tint the body with the `color` prop or the --mascot-color CSS variable
// (defaults to black); `eyeColor` sets the eyes (defaults to white).

// [cx, cy, r] of the fur clumps around the ring; a centre disc fills the middle.
const FUR = [
  [56.3, 14.5, 12], [68.0, 18.8, 10.5], [77.6, 26.9, 12.5],
  [83.8, 37.7, 11], [86.0, 50.0, 11.5], [83.8, 62.3, 12.5],
  [77.6, 73.1, 10.5], [68.0, 81.2, 12], [56.3, 85.5, 11],
  [43.7, 85.5, 12.5], [32.0, 81.2, 10.5], [22.4, 73.1, 11.5],
  [16.2, 62.3, 12.5], [14.0, 50.0, 11], [16.2, 37.7, 12],
  [22.4, 26.9, 10.5], [32.0, 18.8, 12], [43.7, 14.5, 11]
];

const EYE_X = [37, 63];
const EYE_Y = 47;

export const MASCOT_STATES = ["neutral", "happy", "sad", "sleepy", "loading", "empty"];

const STATE_LABELS = {
  neutral: "frfro",
  happy: "frfro، خوشحال",
  sad: "frfro، نگران",
  sleepy: "frfro، خواب‌آلود",
  loading: "frfro، در حال بارگذاری",
  empty: "frfro، اینجا هنوز چیزی نیست"
};

function Capsule({ cx, cy = EYE_Y, w, h, tilt = 0 }) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={w / 2}
      ry={h / 2}
      transform={tilt ? `rotate(${tilt} ${cx} ${cy})` : undefined}
    />
  );
}

function Eyes({ state }) {
  const [left, right] = EYE_X;
  switch (state) {
    case "happy":
      // Thin crescents: an arc over each eye anchor.
      return EYE_X.map((cx) => (
        <path
          key={cx}
          d={`M${cx - 7} ${EYE_Y + 6}A9 9 0 0 1 ${cx + 7} ${EYE_Y + 6}`}
          fill="none"
          style={{ stroke: "var(--mascot-eye)" }}
          strokeWidth="5"
          strokeLinecap="round"
        />
      ));
    case "sad":
      // Smaller, lowered, tilted so the inner ends sit higher.
      return (
        <>
          <Capsule cx={left + 1} cy={EYE_Y + 5} w={12} h={15} tilt={14} />
          <Capsule cx={right - 1} cy={EYE_Y + 5} w={12} h={15} tilt={-14} />
        </>
      );
    case "sleepy":
      // Thin horizontal slits.
      return EYE_X.map((cx) => <Capsule key={cx} cx={cx} cy={EYE_Y + 6} w={16} h={5} />);
    case "loading":
      // A spinner arc in place of each eye; .mascot__spin rotates it (brand.css).
      return EYE_X.map((cx, i) => {
        const x = i === 0 ? cx - 1 : cx + 1;
        return (
          <g key={cx} className="mascot__spin" style={{ transformOrigin: `${x}px ${EYE_Y + 2}px` }}>
            <circle
              cx={x}
              cy={EYE_Y + 2}
              r="7"
              fill="none"
              style={{ stroke: "var(--mascot-eye)" }}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray="32 12"
            />
          </g>
        );
      });
    case "empty":
      // Slightly wider, a touch further apart.
      return (
        <>
          <Capsule cx={left - 2} w={19} h={23} />
          <Capsule cx={right + 2} w={19} h={23} />
        </>
      );
    default:
      return (
        <>
          <Capsule cx={left} w={15} h={20} />
          <Capsule cx={right} w={15} h={20} />
        </>
      );
  }
}

/**
 * @param {object} props
 * @param {"neutral"|"happy"|"sad"|"sleepy"|"loading"|"empty"} [props.state]
 * @param {number|string} [props.size] width and height (the viewBox scales)
 * @param {string} [props.color] body colour; falls back to --mascot-color, then black
 * @param {string} [props.eyeColor] eye colour; falls back to --mascot-eye-color, then white
 * @param {string} [props.title] accessible name; when omitted the mascot is decorative
 */
export function Mascot({ state = "neutral", size = 96, color, eyeColor, title, className = "", style, ...rest }) {
  const known = MASCOT_STATES.includes(state) ? state : "neutral";
  const label = title === true ? STATE_LABELS[known] : title;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`mascot is-${known} ${className}`.trim()}
      style={{
        color: color || "var(--mascot-color, #000)",
        "--mascot-eye": eyeColor || "var(--mascot-eye-color, #fff)",
        ...style
      }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
      {...rest}
    >
      <g fill="currentColor">
        <circle cx="50" cy="50" r="39" />
        {FUR.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <g style={{ fill: "var(--mascot-eye)" }}>
        <Eyes state={known} />
      </g>
    </svg>
  );
}
