"use client";

// NOTE: this used to import { Display } from "react-7-segment-display".
// That package (all published versions, including latest 1.1.5) ships only
// raw TypeScript source with no compiled dist/ output, even though its own
// package.json points "main"/"module" at dist/cjs/index.js and
// dist/esm/index.js. That makes it impossible to import in any project,
// on any React version — it broke `next build` outright. The tiny
// self-contained 7-segment renderer below reproduces the same visuals
// (segment layout, skew, glow) without depending on that broken package.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const SIZE_HEIGHT = {
  xxs: 12,
  xs: 24,
  sm: 34,
  md: 48,
  lg: 60
};

const CHAR_SEGMENTS = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
  "-": [0, 0, 0, 0, 0, 0, 1]
};

const SEGMENT_LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

const SEGMENT_STYLE = {
  A: { marginTop: 0, marginLeft: 0.9, transform: "none", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 10% 100%, 0 50%, 10% 0)" },
  B: { marginTop: 2.65, marginLeft: 3.55, transform: "rotate(90deg)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 10% 100%, 0 50%, 10% 0)" },
  C: { marginTop: 7.95, marginLeft: 3.55, transform: "rotate(90deg)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 10% 100%, 0 50%, 10% 0)" },
  D: { marginTop: 10.6, marginLeft: 0.9, transform: "none", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 10% 100%, 0 50%, 10% 0)" },
  E: { marginTop: 7.95, marginLeft: -1.75, transform: "rotate(90deg)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 10% 100%, 0 50%, 10% 0)" },
  F: { marginTop: 2.65, marginLeft: -1.75, transform: "rotate(90deg)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 10% 100%, 0 50%, 10% 0)" },
  G: { marginTop: 5.3, marginLeft: 0.9, transform: "none", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 10% 100%, 0 50%, 10% 0)" }
};

const SKEWED_SEGMENT_STYLE = {
  A: { marginTop: 0, marginLeft: 1.575, transform: "none", clipPath: "polygon(92.5% 0%, 100% 30%, 85.5% 100%, 15.5% 100%, 0px 30%, 5.5% 0%)" },
  B: { marginTop: 2.4, marginLeft: 3.8, transform: "rotate(95deg)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 15.5% 100%, 0px 30%, 5.5% 0%)" },
  C: { marginTop: 7.625, marginLeft: 3.375, transform: "rotate(95deg) scaleX(-1) scaleY(-1)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 7% 100%, 0px 73%, 11.5% 0%)" },
  D: { marginTop: 10.075, marginLeft: 0.725, transform: "scaleY(-1)", clipPath: "polygon(92.5% 0%, 100% 30%, 85.5% 100%, 15.5% 100%, 0px 30%, 5.5% 0%)" },
  E: { marginTop: 7.65, marginLeft: -1.475, transform: "rotate(95deg) scaleX(-1) scaleY(-1)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 15.5% 100%, 0px 30%, 5.5% 0%)" },
  F: { marginTop: 2.425, marginLeft: -1.025, transform: "rotate(95deg)", clipPath: "polygon(90% 0%, 100% 50%, 90% 100%, 7% 100%, 0px 73%, 11.5% 0%)" },
  G: { marginTop: 5, marginLeft: 1.175, transform: "none", clipPath: "polygon(86% 0%, 95% 51%, 83% 100%, 14% 100%, 6% 54%, 19% 0%)" }
};

export function toLatinDigits(value) {
  return String(value || "").replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

export function parseClockTime(value) {
  const text = String(value ?? "");
  const match = text.match(/([۰-۹0-9]{1,2})[:：]([۰-۹0-9]{2})/);
  if (!match) return null;

  const hours = toLatinDigits(match[1]).padStart(2, "0");
  const minutes = toLatinDigits(match[2]);
  return {
    hours,
    minutes,
    label: `${hours}:${minutes}`,
    prefix: text.slice(0, match.index),
    suffix: text.slice(match.index + match[0].length),
    raw: match[0]
  };
}

function Segment({ active, color, size, id, skew }) {
  const ss = (skew ? SKEWED_SEGMENT_STYLE : SEGMENT_STYLE)[id];
  if (!ss) return null;

  const outerStyle = {
    filter: active ? `drop-shadow(0px 0px ${size * 0.3}px ${color})` : "none",
    padding: size * 0.3,
    width: "fit-content",
    position: "absolute",
    transform: ss.transform,
    marginTop: `${size * ss.marginTop}px`,
    marginLeft: `${size * ss.marginLeft}px`,
    zIndex: 2
  };

  const innerStyle = {
    backgroundColor: color,
    // Unlit segments stay faintly visible (LCD look) but must never compete
    // with the lit ones -- times are the key info on every booking.
    filter: active ? "opacity(1) grayscale(0)" : "opacity(0.07) grayscale(1)",
    color,
    clipPath: ss.clipPath,
    WebkitClipPath: ss.clipPath,
    height: `${size}px`,
    width: `${size * 5}px`
  };

  return (
    <div style={outerStyle}>
      <div style={innerStyle} />
    </div>
  );
}

function SevenSegmentDigit({ char, color, height, skew }) {
  const segments = CHAR_SEGMENTS[char] || CHAR_SEGMENTS["-"];
  const size = height / 12.5;
  const style = {
    position: "relative",
    height: `${height}px`,
    width: `${height * 0.6}px`,
    zIndex: 1,
    padding: skew ? "8px 0px" : "0",
    boxSizing: "border-box"
  };

  return (
    <div style={style}>
      {segments.map((active, index) => (
        <Segment
          key={SEGMENT_LETTERS[index]}
          active={active === 1}
          size={size}
          color={color}
          id={SEGMENT_LETTERS[index]}
          skew={skew}
        />
      ))}
    </div>
  );
}

function SevenSegmentDisplay({ value, count, height, color, skew }) {
  const raw = value == null ? "" : String(value);
  const chars = raw ? raw.split("") : [];
  while (chars.length < count) chars.unshift("0");

  const style = {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: "fit-content",
    width: "fit-content"
  };

  return (
    <div style={style}>
      {chars.map((char, index) => (
        <SevenSegmentDigit key={index} char={char} height={height} color={color} skew={skew} />
      ))}
    </div>
  );
}

function SegmentDigits({ hours, minutes, height, color, skew }) {
  return (
    <span className="segmentClockFace">
      <SevenSegmentDisplay value={hours} count={2} height={height} color={color} skew={skew} />
      <span className="segmentClockColon" aria-hidden="true">
        <i />
        <i />
      </span>
      <SevenSegmentDisplay value={minutes} count={2} height={height} color={color} skew={skew} />
    </span>
  );
}

export function SegmentClock({
  value,
  size = "md",
  className = "",
  color = "#111318",
  backgroundColor = "#ffffff",
  skew = true,
  as = "time"
}) {
  const parsed = parseClockTime(value);
  const Tag = as;
  const classes = ["segmentClock", `is-${size}`, className].filter(Boolean).join(" ");

  if (!parsed) {
    return <Tag className={classes}>{value}</Tag>;
  }

  const height = SIZE_HEIGHT[size] || SIZE_HEIGHT.md;
  const hasText = Boolean(parsed.prefix || parsed.suffix);

  return (
    <Tag
      className={`${classes}${hasText ? " has-text" : ""}`}
      dateTime={as === "time" ? parsed.label : undefined}
      aria-label={parsed.label}
      style={{ "--segment-clock-bg": backgroundColor, "--segment-clock-color": color }}
    >
      {parsed.prefix ? <span className="segmentClockPrefix">{parsed.prefix}</span> : null}
      <SegmentDigits
        hours={parsed.hours}
        minutes={parsed.minutes}
        height={height}
        color={color}
        skew={size === "xxs" || size === "xs" ? false : skew}
      />
      {parsed.suffix ? <span className="segmentClockSuffix">{parsed.suffix}</span> : null}
    </Tag>
  );
}

export function SegmentClockRange({ open, close, size = "sm", className = "" }) {
  return (
    <span className={`segmentClockRange ${className}`.trim()}>
      <SegmentClock value={open} size={size} as="span" />
      <em>تا</em>
      <SegmentClock value={close} size={size} as="span" />
    </span>
  );
}
