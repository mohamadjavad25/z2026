import { LocationButton } from "./LocationButton";
import { InstagramButton } from "./InstagramButton";

/**
 * Cover + logo header of the public salon and artist pages. The cover and the logo
 * look exactly like the owner's own panel hero: `variant` "salon" (inset cover with
 * rounded bottom) or "artist" (full-width poster under a rounded white sheet).
 * `start` / `end` are the round buttons on the cover (back / share, save).
 * `location` (lib/location.js publicLocation) puts the map pin next to the name, `instagram` (the page name) the
 * Instagram button after it.
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
  location = null,
  instagram = "",
  start = null,
  end = null,
  variant = "salon"
}) {
  return (
    <header className={`pphHero is-${variant === "artist" ? "artist" : "salon"}`}>
      <div className="pphCover">
        {cover ? (
          <img className="pphCoverImage" fetchPriority="low" src={cover} alt={coverAlt} aria-hidden={coverAlt ? undefined : "true"} style={{ objectPosition: coverPosition }} />
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
        <div className="pphNameRow">
          <h2>{name}</h2>
          <LocationButton name={name} location={location} />
          <InstagramButton name={name} instagram={instagram} />
        </div>
        {area ? <p>{area}</p> : null}
      </div>
    </header>
  );
}
