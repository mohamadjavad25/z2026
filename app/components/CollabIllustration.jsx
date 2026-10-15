import { PAGE_ICON_ART } from "./PageIcon";

/**
 * Concept art for the collaboration page: a salon and an artist, joined by a
 * partnership badge, with a dashed "proposal" arc between them.
 */
export function CollabIllustration() {
  return (
    <svg className="collabIllustration" viewBox="0 0 320 150" role="img" aria-label="همکاری سالن و آرتیست" focusable="false">
      <ellipse cx="160" cy="132" rx="118" ry="9" fill="var(--n-900)" opacity=".07" />
      <path d="M62 38 Q160 -14 258 38" fill="none" stroke="#FF86B8" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 9" />
      <path d="M106 80 H124 M196 80 H214" fill="none" stroke="var(--n-900)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" opacity=".55" />

      <g>
        <rect x="20" y="38" width="88" height="88" rx="28" fill="#FFE9F2" stroke="var(--n-900)" strokeWidth="2.4" />
        <g className="pageIcon" transform="translate(28 46) scale(2.1)" dangerouslySetInnerHTML={{ __html: PAGE_ICON_ART.salon }} />
      </g>
      <g>
        <rect x="212" y="38" width="88" height="88" rx="28" fill="#EFEAFF" stroke="var(--n-900)" strokeWidth="2.4" />
        <g className="pageIcon" transform="translate(220 46) scale(2.1)" dangerouslySetInnerHTML={{ __html: PAGE_ICON_ART.me }} />
      </g>

      <circle cx="160" cy="80" r="38" fill="var(--n-0)" stroke="var(--n-900)" strokeWidth="2.6" />
      <g className="pageIcon" transform="translate(131 51) scale(1.8)" dangerouslySetInnerHTML={{ __html: PAGE_ICON_ART.collab }} />

      <path d="M160 6 l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#B9A6FF" />
      <path d="M52 14 l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6z" fill="#8B6CFF" />
      <path d="M270 16 l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6z" fill="#8B6CFF" />
      <circle cx="104" cy="22" r="4" fill="#FF86B8" />
      <circle cx="222" cy="18" r="4" fill="#8B6CFF" />
      <circle cx="304" cy="68" r="3.4" fill="#B9A6FF" />
      <circle cx="14" cy="76" r="3.4" fill="#FF86B8" />
    </svg>
  );
}
