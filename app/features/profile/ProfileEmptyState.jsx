export function ProfileEmptyState({
  className = "",
  image,
  visual,
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  role
}) {
  return (
    <div className={`profileEmptyState ${className}`.trim()} role={role}>
      {visual ? (
        visual
      ) : image ? (
        <img src={image} alt="" aria-hidden="true" draggable={false} />
      ) : Icon ? (
        <span className="profileEmptyIcon" aria-hidden="true">
          <Icon size={24} />
        </span>
      ) : null}
      <b>{title}</b>
      {description ? <span>{description}</span> : null}
      {onAction && actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
