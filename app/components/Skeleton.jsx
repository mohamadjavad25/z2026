"use client";

/**
 * The one skeleton (shimmer, brand-neutral). A skeleton has the shape of what is coming,
 * so nothing jumps when the content lands.
 * SkeletonList variants: "list" | "card" | "feed" | "row".
 * Shapes: SkeletonHead (profile header), SkeletonGrid (photos), SkeletonSlots (free times),
 * SkeletonStats (numbers), SkeletonPage (a whole public page, used by loading.jsx).
 */
export function SkeletonBlock({ className = "", style, ...rest }) {
  return (
    <span
      className={`uxSkeletonBlock ${className}`.trim()}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonList({
  rows = 3,
  variant = "list",
  className = "",
  label = "در حال بارگذاری"
}) {
  const count = Math.max(1, Number(rows) || 3);
  const items = Array.from({ length: count }, (_, index) => index);

  return (
    <div
      className={`uxSkeletonList is-${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {items.map((index) => (
        <div className="uxSkeletonItem" key={`sk-${variant}-${index}`}>
          {variant === "card" || variant === "feed" ? (
            <>
              <SkeletonBlock className="uxSkeletonMedia" />
              <div className="uxSkeletonCopy">
                <SkeletonBlock className="uxSkeletonLine is-title" />
                <SkeletonBlock className="uxSkeletonLine is-meta" />
              </div>
            </>
          ) : variant === "row" ? (
            <>
              <SkeletonBlock className="uxSkeletonAvatar" />
              <div className="uxSkeletonCopy">
                <SkeletonBlock className="uxSkeletonLine is-title" />
                <SkeletonBlock className="uxSkeletonLine is-meta" />
              </div>
              <SkeletonBlock className="uxSkeletonChip" />
            </>
          ) : (
            <div className="uxSkeletonCopy is-full">
              <SkeletonBlock className="uxSkeletonLine is-title" />
              <SkeletonBlock className="uxSkeletonLine is-meta" />
              <SkeletonBlock className="uxSkeletonLine is-short" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SkeletonHead() {
  return (
    <div className="uxSkeletonHead" aria-hidden="true">
      <SkeletonBlock className="is-round" style={{ width: 64, height: 64 }} />
      <div className="uxSkeletonCopy">
        <SkeletonBlock className="uxSkeletonLine is-title" style={{ height: 16 }} />
        <SkeletonBlock className="uxSkeletonLine is-meta" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="uxSkeletonGrid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <SkeletonBlock key={index} />)}
    </div>
  );
}

export function SkeletonSlots({ count = 8 }) {
  return (
    <div className="uxSkeletonSlots" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <SkeletonBlock key={index} className="is-pill" />)}
    </div>
  );
}

export function SkeletonStats({ count = 3 }) {
  return (
    <div className="uxSkeletonStats" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <SkeletonBlock key={index} />)}
    </div>
  );
}

// A whole public page (salon or artist): header, a few services, a photo grid.
export function SkeletonPage({ label = "در حال بارگذاری صفحه" }) {
  return (
    <main className="uxSkeletonPage" role="status" aria-live="polite" aria-label={label}>
      <SkeletonHead />
      <SkeletonStats />
      <div className="uxSkeletonSection">
        <SkeletonBlock className="uxSkeletonLine is-title" />
        <SkeletonList rows={3} variant="card" label="" />
      </div>
      <div className="uxSkeletonSection">
        <SkeletonBlock className="uxSkeletonLine is-title" />
        <SkeletonGrid />
      </div>
    </main>
  );
}
