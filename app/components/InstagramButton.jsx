import { instagramUrl } from "../shared/lib/instagram";

/** Instagram's glyph, drawn here: lucide-react 1.x carries no brand icons. */
export function InstagramGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The round Instagram button next to the name on a public salon or artist page (owner's choice 2026-10-27, «الف»).
 * Opens the page itself (Instagram's app catches the link on a phone; in the Android shell an outside link leaves
 * the app). Nothing shows when the salon or artist has not set a page.
 */
export function InstagramButton({ name = "", instagram = "" }) {
  if (!instagram) return null;
  return (
    <a
      className="igButton"
      href={instagramUrl(instagram)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`اینستاگرام ${name || ""}`.trim()}
      title={`@${instagram}`}
    >
      <InstagramGlyph />
    </a>
  );
}
