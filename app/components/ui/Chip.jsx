"use client";

/** A pill that is either a filter/choice (pass `selected`) or a read-only tag (omit onClick). */
export function Chip({ selected = false, onClick, icon: Icon, className = "", children, ...rest }) {
  const classes = ["ui-chip", selected ? "is-selected" : "", className].filter(Boolean).join(" ");
  if (!onClick) {
    return (
      <span className={classes} {...rest}>
        {Icon ? <Icon size={14} aria-hidden="true" /> : null}
        {children}
      </span>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={selected} {...rest}>
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
