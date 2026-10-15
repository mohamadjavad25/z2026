import { PAGE_ICON_ART, PAGE_ICON_NAMES } from "./pageIconArt";

/**
 * Section / page icons: one concept per place in the app, drawn on a 32px grid
 * (art in pageIconArt.js). An ink outline plus pink and violet accent fills,
 * all driven by CSS variables so they follow day/night mode. Tabs show the
 * outline when idle and the full colour when active (services.css).
 *
 * names: posts | salon | me | staff | services | bookings | collab |
 *        settings | customers | discover | activity | booking-add
 */
export { PAGE_ICON_ART, PAGE_ICON_NAMES };

export function PageIcon({ name, size = 22, className = "" }) {
  const inner = PAGE_ICON_ART[name];
  if (!inner) return null;
  return (
    <svg
      className={`pageIcon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
