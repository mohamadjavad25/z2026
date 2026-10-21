"use client";

/**
 * The one spinner (brand blend ring). `size` in px; `current` takes the text colour,
 * for use inside a filled button. Decorative: the surrounding element carries the label.
 */
export function Spinner({ size = 20, current = false, className = "" }) {
  return (
    <span
      className={`loadSpinner${current ? " is-current" : ""} ${className}`.trim()}
      style={{ "--s": `${size}px` }}
      aria-hidden="true"
    />
  );
}
