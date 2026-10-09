// The frfro mascot: an upright rounded block of woolly black fur with two white capsule
// eyes. Drawn on a 100-unit grid, flat colour only (no gradients, outlines or
// shadows). The body is one union of circles, so every tuft ends in a soft
// curve. Every state is derived from the same two eye anchors (EYE_X, EYE_Y),
// so the family stays consistent at any size.
//
// Tint the body with the `color` prop or the --mascot-color CSS variable
// (defaults to black); `eyeColor` sets the eyes (defaults to white).

// [cx, cy, r] of the fur clumps around a rounded rectangle; a centre block fills the middle.
const FUR = [
  [28, 20, 12], [37, 16, 10.5], [50, 16, 12], [63, 16, 11],
  [72, 20, 12.5], [76, 27.3, 10.5], [76, 38.7, 11.5], [76, 50, 12],
  [76, 61.3, 11.5], [76, 72.7, 10.5], [72, 80, 12], [63, 84, 11],
  [50, 84, 12.5], [37, 84, 10.5], [28, 80, 12.5], [24, 72.7, 12],
  [24, 61.3, 11.5], [24, 50, 10.5], [24, 38.7, 12], [24, 27.3, 11]
];

const EYE_X = [39.5, 60.5];
const EYE_Y = 44;

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
    <rect
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      rx={w / 2}
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
          <Capsule cx={left + 1} cy={EYE_Y + 5} w={9} h={20} tilt={14} />
          <Capsule cx={right - 1} cy={EYE_Y + 5} w={9} h={20} tilt={-14} />
        </>
      );
    case "sleepy":
      // Thin horizontal slits.
      return EYE_X.map((cx) => <Capsule key={cx} cx={cx} cy={EYE_Y + 6} w={15} h={4.5} />);
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
          <Capsule cx={left - 1} w={14} h={31} />
          <Capsule cx={right + 1} w={14} h={31} />
        </>
      );
    default:
      return (
        <>
          <Capsule cx={left} w={11} h={31} />
          <Capsule cx={right} w={11} h={31} />
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
