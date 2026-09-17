"use client";

/**
 * Lightweight reusable skeleton placeholders (shimmer).
 * variant: "list" | "card" | "feed" | "row"
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
