/**
 * Cover + logo header of the public salon and artist pages. Same look as the
 * salon's own panel hero: full-width cover, the logo on the right half over
 * the cover's bottom edge, name and city beside it.
 * `start` / `end` are the round buttons on the cover (back / share, save).
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
  start = null,
  end = null
}) {
  return (
    <header className="pphHero">
      <div className="pphCover">
        {cover ? (
          <img className="pphCoverImage" src={cover} alt={coverAlt} aria-hidden={coverAlt ? undefined : "true"} style={{ objectPosition: coverPosition }} />
        ) : null}
        <div className="pphTopbar">
          {start}
          {end ? <div className="pphTopActions">{end}</div> : null}
        </div>
      </div>
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
