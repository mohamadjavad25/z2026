/**
 * Section / page icons -- one concept per place in the app, drawn on a 32px
 * grid: ink outlines in `currentColor` (so they follow the surrounding text
 * colour, light or dark) plus vivid accent fills. Inactive tabs are muted by
 * CSS (.pageIcon), the active one shows its full colour (see services.css).
 *
 * names: posts | salon | me | staff | services | bookings | collab |
 *        settings | customers | discover | activity | booking-add
 */
const S = 'class="pi-s" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ART = {
  // photo stack with a sun, hill and a sparkle
  posts: `<rect x="10" y="3.5" width="17" height="17" rx="4.5" fill="#FF7AA8" transform="rotate(9 18.5 12)"/><rect x="3.5" y="8.5" width="21" height="20" rx="5" fill="#fff" ${S}/><circle cx="10.2" cy="15" r="2.5" fill="#FFC83D"/><path d="M4.5 26.5 L11 19.8 L15 23.8 L18.6 20.3 L24 25.8 V27 Q24 28 23 28 H6 Q4.5 28 4.5 26.5Z" fill="#34D3A4"/><path d="M27 3 l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z" fill="#FFC83D"/>`,
  // storefront: striped scalloped awning, window, door
  salon: `<path d="M5 12 L7.5 4.5 H24.5 L27 12Z" fill="#FF6B5E"/><path d="M12 4.5 H15.4 L14.4 12 H9.8Z M18.6 4.5 H22 L22.2 12 H17.6Z" fill="#fff" opacity=".85"/><path d="M5 12 q2.7 4 5.4 0 q2.8 4 5.6 0 q2.8 4 5.6 0 q2.7 4 5.4 0" fill="#FF6B5E" stroke="#FF6B5E" stroke-width="1"/><path d="M7 15.5 V27 Q7 28 8 28 H24 Q25 28 25 27 V15.5" fill="#fff" ${S}/><rect x="13.5" y="19" width="5.5" height="9" rx="1.6" fill="#4FB3FF"/><circle cx="10.6" cy="21" r="1.7" fill="#FF7AA8"/><circle cx="22.4" cy="21" r="1.7" fill="#FFC83D"/>`,
  // profile: head + shoulders with a heart badge
  me: `<circle cx="15" cy="10.5" r="5.8" fill="#F8CBA8" ${S}/><path d="M4.5 28 Q4.5 18.5 15 18.5 Q25.5 18.5 25.5 28Z" fill="#FF7AA8" ${S}/><path d="M24.5 4.2 c-1.9-1.7-4.6 0-3.4 2 l3.4 3 l3.4-3 c1.2-2-1.5-3.7-3.4-2z" fill="#F43F7E"/>`,
  // team: a big and a small person, and a star badge
  staff: `<circle cx="11.5" cy="10" r="5.2" fill="#F8CBA8" ${S}/><path d="M2.5 27 Q2.5 17.5 11.5 17.5 Q20.5 17.5 20.5 27Z" fill="#17B8C8" ${S}/><circle cx="23" cy="13" r="3.8" fill="#EDA97E" ${S}/><path d="M17.2 27 Q17.5 19.3 23 19.3 Q29 19.3 29.5 27Z" fill="#FFC83D" ${S}/><path d="M26.5 3 l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="#FF6B5E"/>`,
  // service menu: card with items and a sparkle
  services: `<rect x="5.5" y="3.5" width="19" height="25" rx="4.5" fill="#fff" ${S}/><rect x="5.5" y="3.5" width="19" height="7" rx="4" fill="#FF7AA8"/><circle cx="10.5" cy="16" r="1.9" fill="#34D3A4"/><path d="M14.5 16 H21" ${S} />
<circle cx="10.5" cy="21" r="1.9" fill="#FFC83D"/><path d="M14.5 21 H21" ${S}/><circle cx="10.5" cy="26" r="0" fill="none"/><path d="M26.5 14 l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#B75CFF"/>`,
  // calendar with a confirmed-check badge
  bookings: `<rect x="3.5" y="6" width="22" height="21" rx="5" fill="#fff" ${S}/><path d="M3.5 11 Q3.5 6 8.5 6 H20.5 Q25.5 6 25.5 11 V13 H3.5Z" fill="#FF6B5E"/><path d="M9.5 3.5 V8 M19.5 3.5 V8" ${S}/><rect x="8" y="17" width="3" height="3" rx="1" fill="#FFC83D"/><rect x="13" y="17" width="3" height="3" rx="1" fill="#4FB3FF"/><circle cx="23.5" cy="23.5" r="6.2" fill="#34D3A4" stroke="#fff" stroke-width="2"/><path d="M20.7 23.6 l2 2 3.6-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  // partnership: two overlapping circles with a shared spark
  collab: `<circle cx="11.5" cy="17" r="8.5" fill="#FF7AA8" opacity=".92"/><circle cx="20.5" cy="17" r="8.5" fill="#4FB3FF" opacity=".92"/><path d="M16 9.4 A8.5 8.5 0 0 1 16 24.6 A8.5 8.5 0 0 1 16 9.4Z" fill="#FFC83D"/><circle cx="11.5" cy="17" r="8.5" fill="none" ${S}/><circle cx="20.5" cy="17" r="8.5" fill="none" ${S}/><path d="M16 13.2 l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#fff"/><circle cx="6" cy="5.5" r="1.7" fill="#FF7AA8"/><circle cx="26.5" cy="5" r="1.7" fill="#4FB3FF"/>`,
  // settings: gear with a sun-like core and a heart
  settings: `<g fill="#9AA6BF"><rect x="13.5" y="2.5" width="5" height="27" rx="2.2"/><rect x="13.5" y="2.5" width="5" height="27" rx="2.2" transform="rotate(45 16 16)"/><rect x="13.5" y="2.5" width="5" height="27" rx="2.2" transform="rotate(90 16 16)"/><rect x="13.5" y="2.5" width="5" height="27" rx="2.2" transform="rotate(135 16 16)"/></g><circle cx="16" cy="16" r="8.6" fill="#4FB3FF" ${S}/><circle cx="16" cy="16" r="4.6" fill="#fff" ${S}/><path d="M16 18.6 c-2.4-1.6-2.6-3.4-1.3-4 c.7-.3 1.3 0 1.3.7 c0-.7.6-1 1.3-.7 c1.3.6 1.1 2.4-1.3 4z" fill="#F43F7E"/>`,
  // customers: three smiling guests and a heart over the middle one
  customers: `<circle cx="7" cy="15" r="3.4" fill="#F8CBA8" ${S}/><path d="M1.5 27 Q1.5 20 7 20 Q12.5 20 12.5 27Z" fill="#FFC83D" ${S}/><circle cx="25" cy="15" r="3.4" fill="#EDA97E" ${S}/><path d="M19.5 27 Q19.5 20 25 20 Q30.5 20 30.5 27Z" fill="#4FB3FF" ${S}/><circle cx="16" cy="14" r="4.4" fill="#F8CBA8" ${S}/><path d="M8.8 28 Q8.8 19.6 16 19.6 Q23.2 19.6 23.2 28Z" fill="#FF7AA8" ${S}/><path d="M16 9 c-3-2.4-6.6.2-4.8 3 L16 16.2 l4.8-4.2 C22.6 9.2 19 6.6 16 9z" fill="#F43F7E" transform="translate(0 -6.5) scale(1 1)"/>`,
  // discover: map pin with a storefront heart
  discover: `<path d="M16 30 C8.5 21.5 5 17.5 5 12.5 A11 11 0 0 1 27 12.5 C27 17.5 23.5 21.5 16 30Z" fill="#F43F7E" ${S}/><circle cx="16" cy="12.5" r="6.2" fill="#fff"/><path d="M16 16.6 c-3.6-2.4-4.4-5.2-2.4-6.2 c1.1-.5 2.1.1 2.4 1 c.3-.9 1.3-1.5 2.4-1 c2 1 1.2 3.8-2.4 6.2z" fill="#FF6B5E"/><ellipse cx="16" cy="30" rx="5" ry="1.4" fill="#14161d" opacity=".16"/>`,
  // my activity: a ticket with a heart and a perforation
  activity: `<path d="M3.5 9.5 Q3.5 7 6 7 H26 Q28.5 7 28.5 9.5 V13 A3 3 0 0 0 28.5 19 V22.5 Q28.5 25 26 25 H6 Q3.5 25 3.5 22.5 V19 A3 3 0 0 0 3.5 13Z" fill="#FFC83D" ${S}/><path d="M11.5 9 V23" class="pi-s" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1.6 3.2"/><path d="M20 20.8 c-4-2.6-4.8-5.8-2.4-6.8 c1.3-.5 2.3.2 2.4 1.2 c.1-1 1.1-1.7 2.4-1.2 c2.4 1 1.6 4.2-2.4 6.8z" fill="#fff"/>`,
  // quick-add booking: calendar with a plus
  "booking-add": `<rect x="3.5" y="6" width="22" height="21" rx="5" fill="#fff" ${S}/><path d="M3.5 11 Q3.5 6 8.5 6 H20.5 Q25.5 6 25.5 11 V13 H3.5Z" fill="#FF6B5E"/><path d="M9.5 3.5 V8 M19.5 3.5 V8" ${S}/><circle cx="23.5" cy="23.5" r="6.4" fill="#14161d" stroke="#fff" stroke-width="2"/><path d="M23.5 20.6 V26.4 M20.6 23.5 H26.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`
};

export const PAGE_ICON_NAMES = Object.keys(ART);

/** Raw 32px-grid art, for compositions (illustrations) that embed several icons. */
export const PAGE_ICON_ART = ART;

export function PageIcon({ name, size = 22, className = "" }) {
  const inner = ART[name];
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
