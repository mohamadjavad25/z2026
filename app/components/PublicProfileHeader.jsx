/**
 * Cover + logo header of the public salon and artist pages. The cover and the logo
 * look exactly like the owner's own panel hero: `variant` "salon" (inset cover with
 * rounded bottom) or "artist" (full-width poster under a rounded white sheet).
 * `start` / `end` are the round buttons on the cover (back / share, save).
 * `coverBadge` hangs off the cover's bottom-left corner the way the logo hangs off the right one (the salon's
 * Instagram folder, components/InstagramFolder; owner's sketch 2026-10-27). The map pin is no longer next to the
 * name: the pages put it at the start of their buttons row (LocationButton `variant="action"`).
 */
export function PublicProfileHeader({
  cover = "",
  coverAlt = "",
  coverPosition = "50% 50%",
  avatar = "",
  avatarAlt = "",
  avatarPosition = "50% 50%",
  name = "",
  area = "",
  coverBadge = null,
  start = null,
  end = null,
  variant = "salon"
}) {
  return (
    <header className={`pphHero is-${variant === "artist" ? "artist" : "salon"}${coverBadge ? " has-coverBadge" : ""}`}>
      <div className="pphCover">
        {cover ? (
          <img className="pphCoverImage" fetchPriority="low" src={cover} alt={coverAlt} aria-hidden={coverAlt ? undefined : "true"} style={{ objectPosition: coverPosition }} />
        ) : null}
        <div className="pphTopbar">
          {start}
          {end ? <div className="pphTopActions">{end}</div> : null}
        </div>
      </div>
      {coverBadge}
      <span className="pphAvatar">
        {avatar ? (
          <img src={avatar} alt={avatarAlt} style={{ objectPosition: avatarPosition }} />
        ) : (
          <b aria-hidden="true">{String(name || "؟").slice(0, 1)}</b>
        )}
      </span>
      <div className="pphMeta">
        <h2>{name}</h2>
        {area ? <p>{area}</p> : null}
      </div>
    </header>
  );
}
