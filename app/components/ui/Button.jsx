"use client";

/**
 * The one button. Variants: primary (default), secondary, ghost, danger.
 * Sizes: md (44px, the touch-target minimum) and sm (36px, inline use only).
 * `loading` disables the button and shows `loadingLabel` so a double tap can't
 * submit twice; `block` makes it full width.
 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  loadingLabel,
  icon: Icon,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}) {
  const classes = ["ui-btn", `is-${variant}`, size === "sm" ? "is-sm" : "", block ? "is-block" : "", loading ? "is-loading" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {Icon && !loading ? <Icon size={18} aria-hidden="true" /> : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}
