import { PAGE_ICON_ART } from "./PageIcon";

/**
 * Concept art for the collaboration page: a salon and an artist, joined by a
 * partnership badge, with a dashed "proposal" arc between them.
 */
export function CollabIllustration() {
  return (
    <svg className="collabIllustration" viewBox="0 0 320 150" role="img" aria-label="همکاری سالن و آرتیست" focusable="false">
      <ellipse cx="160" cy="132" rx="118" ry="9" fill="#14161d" opacity=".07" />
      <path d="M62 38 Q160 -14 258 38" fill="none" stroke="#FF7AA8" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 9" />
      <path d="M106 80 H124 M196 80 H214" fill="none" stroke="#14161d" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" opacity=".55" />

      <g>
        <rect x="20" y="38" width="88" height="88" rx="28" fill="#FFF1E3" stroke="#14161d" strokeWidth="2.4" />
        <g transform="translate(28 46) scale(2.1)" dangerouslySetInnerHTML={{ __html: PAGE_ICON_ART.salon }} />
      </g>
      <g>
        <rect x="212" y="38" width="88" height="88" rx="28" fill="#E8F3FC" stroke="#14161d" strokeWidth="2.4" />
        <g transform="translate(220 46) scale(2.1)" dangerouslySetInnerHTML={{ __html: PAGE_ICON_ART.me }} />
      </g>

      <circle cx="160" cy="80" r="38" fill="#fff" stroke="#14161d" strokeWidth="2.6" />
      <g transform="translate(131 51) scale(1.8)" dangerouslySetInnerHTML={{ __html: PAGE_ICON_ART.collab }} />

      <path d="M160 6 l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#FFC83D" />
      <path d="M52 14 l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6z" fill="#34D3A4" />
      <path d="M270 16 l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6z" fill="#4FB3FF" />
      <circle cx="104" cy="22" r="4" fill="#FF6B5E" />
      <circle cx="222" cy="18" r="4" fill="#B75CFF" />
      <circle cx="304" cy="68" r="3.4" fill="#FFC83D" />
      <circle cx="14" cy="76" r="3.4" fill="#FF7AA8" />
    </svg>
  );
}
