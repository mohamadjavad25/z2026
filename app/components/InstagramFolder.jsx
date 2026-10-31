import { instagramUrl } from "../shared/lib/instagram";
import { thumbUrl } from "../shared/lib/mediaUrl";

/** Instagram's glyph, drawn here: lucide-react 1.x carries no brand icons. */
export function InstagramGlyph({ size = 18, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.4" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Up to three pictures for the folder: the newest works that have one. */
export function folderPhotos(posts) {
  return (Array.isArray(posts) ? posts : []).map((post) => post?.image).filter(Boolean).slice(0, 3);
}

/**
 * «پوشهٔ اینستاگرام» (owner's design, 2026-10-27): the untouched Instagram logo as the front of a folder, with three
 * of the salon's or artist's own works sticking out of its top (pink and violet cards when there are none yet). The
 * cards peek up now and then and jump out on hover or tap. `size` is the logo's side in px. Decorative: the link
 * around it carries the name.
 */
export function InstagramFolder({ photos = [], size = 48, alive = false }) {
  const cards = [0, 1, 2].map((i) => photos[i] || "");
  return (
    <span className={`igFolder${alive ? " is-alive" : ""}`} style={{ "--igf": `${size}px` }} aria-hidden="true">
      {cards.map((photo, i) => (
        <span
          key={i}
          className={`igFolderPost is-${i + 1}${photo ? "" : " is-plain"}`}
          style={photo ? { backgroundImage: `url("${thumbUrl(photo, 160)}")` } : undefined}
        />
      ))}
      <span className="igFolderFace"><InstagramGlyph className="igFolderGlyph" /></span>
    </span>
  );
}

/** The outside link every placement uses: opens the Instagram page (the phone's Instagram app catches it). */
export function InstagramLink({ instagram, name = "", className, children }) {
  if (!instagram) return null;
  return (
    <a className={className} href={instagramUrl(instagram)} target="_blank" rel="noopener noreferrer" aria-label={`اینستاگرام ${name}`.trim()}>
      {children}
    </a>
  );
}

/** Salon page, «ب»: hanging off the cover's bottom-left corner the way the logo hangs off the right one (owner's
 *  sketch 2026-10-27), the works sticking up into the cover. */
export function InstagramCoverBadge({ instagram, name, photos }) {
  return (
    <InstagramLink instagram={instagram} name={name} className="igCoverBadge">
      <InstagramFolder photos={photos} size={58} alive />
    </InstagramLink>
  );
}

/** Salon page, «الف»: the last square of the works («کارهای بیشتر» and the page name), or a wide card when there are no
 *  works yet. */
export function InstagramWorksTile({ instagram, name, photos, wide = false, className = "" }) {
  return (
    <InstagramLink instagram={instagram} name={name} className={`igWorksTile${wide ? " is-wide" : ""}${className ? ` ${className}` : ""}`}>
      <InstagramFolder photos={photos} size={wide ? 50 : 38} alive />
      <span className="igWorksText">
        <b>{wide ? `کارهای ${name} توی اینستاگرام` : "کارهای بیشتر"}</b>
        {wide ? <span>هنوز اینجا کاری نذاشته؛ پیجش رو ببین <em dir="ltr">@{instagram}</em></span> : <span dir="ltr">@{instagram}</span>}
      </span>
    </InstagramLink>
  );
}

/** Artist page, «ج»: one row under «ساعت کاری». */
export function InstagramRow({ instagram, name, photos }) {
  return (
    <InstagramLink instagram={instagram} name={name} className="igRow">
      <InstagramFolder photos={photos} size={32} />
      <span className="igRowText">
        <b>اینستاگرام</b>
        <span dir="ltr">@{instagram}</span>
      </span>
      <span className="igRowGo">ببین</span>
    </InstagramLink>
  );
}
