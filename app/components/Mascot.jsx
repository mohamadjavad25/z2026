// The frfro mascot: a round curling brush with a cream barrel, soft rounded
// bristles on both sides, a short handle and one loose curl on top. Drawn on a
// 100-unit grid, flat colours only (no gradients, outlines or shadows). Every
// state shares the same body and the same face anchors (EYE_X, EYE_Y, MOUTH_Y),
// so the family stays consistent at any size.
//
// Colours, each a prop or a CSS variable:
//   color      / --mascot-color   caps, bristles, handle (default plum #8b5a7a)
//   faceColor  / --mascot-face    barrel (default cream #f3ece6)
//   accentColor/ --mascot-accent  curl and cheeks (default blush #c45b6a)
//   inkColor   / --mascot-ink     eyes and mouth (default ink #1c202c)

const BRISTLE_ROWS = [28, 35, 42, 49, 56, 63];

const EYE_X = [42.5, 57.5];
const EYE_Y = 39;
const MOUTH_Y = 48;

export const MASCOT_STATES = ["neutral", "happy", "sad", "sleepy", "loading", "empty"];

const STATE_LABELS = {
  neutral: "frfro",
  happy: "frfro، خوشحال",
  sad: "frfro، نگران",
  sleepy: "frfro، خواب‌آلود",
  loading: "frfro، در حال بارگذاری",
  empty: "frfro، اینجا هنوز چیزی نیست"
};

const INK = { fill: "var(--mascot-ink)" };
const INK_LINE = { fill: "none", stroke: "var(--mascot-ink)", strokeLinecap: "round", strokeLinejoin: "round" };

function Eyes({ state }) {
  const [left, right] = EYE_X;
  switch (state) {
    case "happy":
      // Closed, smiling arcs.
      return EYE_X.map((cx) => (
        <path key={cx} d={`M${cx - 3.5} ${EYE_Y + 1.5}Q${cx} ${EYE_Y - 3.5} ${cx + 3.5} ${EYE_Y + 1.5}`} style={INK_LINE} strokeWidth="2.6" />
      ));
    case "sad":
      // Smaller, lowered, inner ends higher.
      return (
        <>
          <ellipse cx={left + 0.5} cy={EYE_Y + 2} rx="2.3" ry="2.8" transform={`rotate(18 ${left + 0.5} ${EYE_Y + 2})`} style={INK} />
          <ellipse cx={right - 0.5} cy={EYE_Y + 2} rx="2.3" ry="2.8" transform={`rotate(-18 ${right - 0.5} ${EYE_Y + 2})`} style={INK} />
        </>
      );
    case "sleepy":
      // Closed lids, curving down.
      return EYE_X.map((cx) => (
        <path key={cx} d={`M${cx - 3.5} ${EYE_Y}Q${cx} ${EYE_Y + 3.5} ${cx + 3.5} ${EYE_Y}`} style={INK_LINE} strokeWidth="2.4" />
      ));
    case "loading":
      // A spinner arc in place of each eye; .mascot__spin rotates it (brand.css).
      return EYE_X.map((cx) => (
        <g key={cx} className="mascot__spin" style={{ transformOrigin: `${cx}px ${EYE_Y}px` }}>
          <circle cx={cx} cy={EYE_Y} r="3.6" style={INK_LINE} strokeWidth="2.4" strokeDasharray="16 7" />
        </g>
      ));
    case "empty":
      // Wider, rounder eyes: curious.
      return EYE_X.map((cx, i) => <ellipse key={cx} cx={i === 0 ? cx - 0.5 : cx + 0.5} cy={EYE_Y} rx="3.6" ry="4.4" style={INK} />);
    default:
      return EYE_X.map((cx) => <ellipse key={cx} cx={cx} cy={EYE_Y} rx="2.8" ry="3.7" style={INK} />);
  }
}

function Mouth({ state }) {
  switch (state) {
    case "happy":
      return <path d={`M44.5 ${MOUTH_Y - 1}Q50 ${MOUTH_Y + 5.5} 55.5 ${MOUTH_Y - 1}`} style={INK_LINE} strokeWidth="2.4" />;
    case "sad":
      return <path d={`M46.5 ${MOUTH_Y + 2}Q50 ${MOUTH_Y - 1} 53.5 ${MOUTH_Y + 2}`} style={INK_LINE} strokeWidth="2.2" />;
    case "sleepy":
      return <ellipse cx="50" cy={MOUTH_Y + 1} rx="1.6" ry="1.9" style={INK} />;
    case "loading":
      return <path d={`M47 ${MOUTH_Y}H53`} style={INK_LINE} strokeWidth="2.2" />;
    case "empty":
      return <ellipse cx="50" cy={MOUTH_Y + 0.5} rx="2" ry="2.4" style={INK} />;
    default:
      return <path d={`M46.5 ${MOUTH_Y - 0.5}Q50 ${MOUTH_Y + 2.8} 53.5 ${MOUTH_Y - 0.5}`} style={INK_LINE} strokeWidth="2.2" />;
  }
}

/**
 * @param {object} props
 * @param {"neutral"|"happy"|"sad"|"sleepy"|"loading"|"empty"} [props.state]
 * @param {number|string} [props.size] width and height (the viewBox scales)
 * @param {string} [props.color] caps, bristles and handle
 * @param {string} [props.faceColor] barrel
 * @param {string} [props.accentColor] curl and cheeks
 * @param {string} [props.inkColor] eyes and mouth
 * @param {string|true} [props.title] accessible name (true = built-in label); when omitted the mascot is decorative
 */
export function Mascot({
  state = "neutral",
  size = 96,
  color,
  faceColor,
  accentColor,
  inkColor,
  title,
  className = "",
  style,
  ...rest
}) {
  const known = MASCOT_STATES.includes(state) ? state : "neutral";
  const label = title === true ? STATE_LABELS[known] : title;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`mascot is-${known} ${className}`.trim()}
      style={{
        color: color || "var(--mascot-color, #8b5a7a)",
        "--mascot-face": faceColor || "var(--mascot-face-color, #f3ece6)",
        "--mascot-accent": accentColor || "var(--mascot-accent-color, #c45b6a)",
        "--mascot-ink": inkColor || "var(--mascot-ink-color, #1c202c)",
        ...style
      }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
      {...rest}
    >
      {/* The curl caught in the brush. */}
      <path
        d="M48 14C46 6 55 1 61 4.5C66.5 8 63.5 15.5 58 14.5C54.5 13.8 55 9.5 58.5 9.5"
        fill="none"
        strokeWidth="3.6"
        strokeLinecap="round"
        style={{ stroke: "var(--mascot-accent)" }}
      />
      <g fill="currentColor">
        {BRISTLE_ROWS.map((y) => (
          <g key={y}>
            <rect x="24" y={y - 2.6} width="12" height="5.2" rx="2.6" />
            <rect x="64" y={y - 2.6} width="12" height="5.2" rx="2.6" />
          </g>
        ))}
        <rect x="45" y="70" width="10" height="24" rx="5" />
      </g>
      <rect x="32" y="17" width="36" height="56" rx="10" style={{ fill: "var(--mascot-face)" }} />
      <g fill="currentColor">
        <rect x="30" y="13" width="40" height="10" rx="5" />
        <rect x="30" y="66" width="40" height="9" rx="4.5" />
      </g>
      <g style={{ fill: "var(--mascot-accent)" }}>
        <ellipse cx="37.5" cy="46" rx="3.2" ry="2" />
        <ellipse cx="62.5" cy="46" rx="3.2" ry="2" />
      </g>
      <Eyes state={known} />
      <Mouth state={known} />
    </svg>
  );
}
