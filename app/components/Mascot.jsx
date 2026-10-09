// The frfro mascot: a fluffy cotton-candy (pashmak) puff with two capsule eyes.
// Drawn on a 100-unit grid in flat colours only (no gradients, outlines or
// shadows): a deeper pink core, a lighter rim of tufts peeking out behind it,
// and the eyes. Every tuft is an ellipse, so the fluff is all soft round ends.
// Every state is derived from the same two eye anchors (EYE_X, EYE_Y), so the
// family stays consistent at any size.
//
// Colours, each a prop or a CSS variable:
//   color    / --mascot-color      core          (default #f48ab8)
//   rimColor / --mascot-rim-color  outer tufts   (default #fbbad6)
//   eyeColor / --mascot-eye-color  eyes          (default #3b1630)

const CORE = "M79.0 50.0L78.8 60.1L78.4 65.5L77.6 69.8L76.5 73.3L75.1 76.4L73.4 79.0L71.3 81.2L68.8 82.9L65.9 84.3L62.5 85.2L58.1 85.8L50.0 86.0L41.9 85.8L37.5 85.2L34.1 84.3L31.2 82.9L28.7 81.2L26.6 79.0L24.9 76.4L23.5 73.3L22.4 69.8L21.6 65.5L21.2 60.1L21.0 50.0L21.2 39.9L21.6 34.5L22.4 30.2L23.5 26.7L24.9 23.6L26.6 21.0L28.7 18.8L31.2 17.1L34.1 15.7L37.5 14.8L41.9 14.2L50.0 14.0L58.1 14.2L62.5 14.8L65.9 15.7L68.8 17.1L71.3 18.8L73.4 21.0L75.1 23.6L76.5 26.7L77.6 30.2L78.4 34.5L78.8 39.9Z";

// [cx, cy, rx, ry, rotation] of the tufts. INNER sit on the core edge in the
// core colour; RIM sit further out, behind the core, in the rim colour.
const INNER = [
  [80.5, 48.5, 10.4, 7.9, 9], [80.9, 57.6, 8.6, 7.6, 8], [79.4, 63.7, 9.9, 7.5, 14], [79.6, 72.1, 9.3, 7.1, 23],
  [73.2, 80.2, 8.5, 6.8, 49], [68.9, 85.5, 9.9, 6.6, 64], [60.7, 87.3, 9.7, 8.4, 90], [52.2, 87.1, 8.1, 6.8, 88],
  [47.8, 87.1, 8.2, 8, 89], [38.6, 87.3, 10.4, 7.9, 96], [31.3, 85.6, 8.3, 6.8, 113], [26.6, 79.7, 9.6, 7.2, 132],
  [20.8, 70.8, 9.4, 8.2, 162], [19.4, 66.3, 9.3, 7.8, 169], [18.6, 56, 9.5, 8.4, 169], [19.9, 48.5, 8, 7.5, -187],
  [19.5, 42.3, 9.9, 8.5, -183], [20, 35.2, 9.6, 8, -188], [20.5, 28.1, 8, 6.5, -169], [25.4, 19.9, 8, 7.7, -148],
  [33.1, 14.2, 8.7, 8.5, -106], [39.2, 11.9, 10.1, 6.8, -98], [46.7, 13.2, 8.4, 7.3, -85], [55.2, 11.5, 9.8, 7.8, -87],
  [62.2, 13.9, 10.4, 7.5, -78], [70, 16, 10.1, 6.9, -48], [74.8, 20.8, 8.5, 7, -26], [77, 26.8, 8, 6.8, -16],
  [79.3, 36.7, 10.5, 6.6, 4], [80.1, 42.8, 9.8, 7.2, 15]
];

const RIM = [
  [82.4, 54.7, 6.5, 4.7, 12], [81.6, 57.8, 6.5, 4.6, 8], [82, 64.6, 7.2, 4.6, 14], [81.2, 70.1, 5.8, 4, 29],
  [80.2, 73.3, 7.5, 4.3, 26], [78, 79, 5.9, 4.8, 51], [73.5, 84.6, 6.4, 4.1, 69], [69.5, 87.1, 6.8, 3.7, 62],
  [63.7, 88.2, 7.3, 4, 70], [58.2, 89.1, 7, 4.9, 81], [55.3, 90.2, 6.9, 4.9, 94], [47.3, 89.2, 5.7, 5, 91],
  [44.3, 89.9, 6.9, 4.6, 96], [38.2, 89.8, 6.6, 3.8, 98], [34.8, 88.5, 6.9, 4.1, 106], [27.5, 83.7, 7.5, 3.6, 114],
  [23.3, 81.8, 6.1, 4.9, 131], [19.4, 75.5, 5.9, 4.2, 151], [17.8, 70.6, 6, 4.9, 162], [19.2, 67.9, 5.6, 4.6, 152],
  [18, 59.7, 5.9, 4.3, 172], [16.3, 55.4, 5.3, 4.1, 161], [16.9, 52.7, 6.1, 4.7, 165], [17.5, 46.4, 5.5, 4.2, -190],
  [17, 42.8, 7.1, 3.9, -184], [16.7, 38.1, 5.6, 4.5, -191], [19.5, 30.4, 6.7, 3.9, -186], [20.4, 24.5, 6.9, 3.8, -176],
  [22.8, 21.5, 6.2, 4.6, -155], [24.1, 17.1, 5.8, 3.7, -157], [28.8, 14.3, 7.5, 4.9, -132], [36.8, 12.2, 5.6, 4.2, -100],
  [41.9, 10.4, 7.2, 3.5, -96], [44.6, 11.2, 7.4, 3.8, -96], [50.8, 9.6, 7.1, 4.7, -85], [56.8, 10, 7.3, 4.4, -84],
  [60.5, 11.2, 6.2, 4.5, -88], [66.5, 12.3, 6.6, 4.5, -68], [70.7, 14.2, 7, 4.2, -50], [76.9, 19.5, 5.5, 4.3, -22],
  [80.2, 23.4, 5.4, 4.1, -10], [81.9, 28.3, 6.9, 3.9, -12], [82.1, 34.7, 6.3, 3.8, -1], [83.5, 39.9, 7.6, 4.3, 2],
  [83.1, 43.7, 5.6, 3.5, 15], [83, 47.7, 5.2, 4.2, 7]
];

function Tuft({ t: [cx, cy, rx, ry, rot] }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} />;
}

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
 * @param {string} [props.color] core colour; falls back to --mascot-color
 * @param {string} [props.rimColor] outer tuft colour; falls back to --mascot-rim-color
 * @param {string} [props.eyeColor] eye colour; falls back to --mascot-eye-color
 * @param {string} [props.title] accessible name; when omitted the mascot is decorative
 */
export function Mascot({ state = "neutral", size = 96, color, rimColor, eyeColor, title, className = "", style, ...rest }) {
  const known = MASCOT_STATES.includes(state) ? state : "neutral";
  const label = title === true ? STATE_LABELS[known] : title;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`mascot is-${known} ${className}`.trim()}
      style={{
        color: color || "var(--mascot-color, #f48ab8)",
        "--mascot-rim": rimColor || "var(--mascot-rim-color, #fbbad6)",
        "--mascot-eye": eyeColor || "var(--mascot-eye-color, #3b1630)",
        ...style
      }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
      {...rest}
    >
      <g style={{ fill: "var(--mascot-rim)" }}>
        {RIM.map((t) => (
          <Tuft key={`${t[0]}-${t[1]}`} t={t} />
        ))}
      </g>
      <g fill="currentColor">
        <path d={CORE} />
        {INNER.map((t) => (
          <Tuft key={`${t[0]}-${t[1]}`} t={t} />
        ))}
      </g>
      <g style={{ fill: "var(--mascot-eye)" }}>
        <Eyes state={known} />
      </g>
    </svg>
  );
}
