/** Custom support glyph: a headset with a small heart. Uses currentColor, so it takes the colour of its button. */
export function SupportIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.5 16.5v-1.2a9.5 9.5 0 0 1 19 0v1.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="3.6" y="15.4" width="5.2" height="9.2" rx="2.6" fill="currentColor" />
      <rect x="23.2" y="15.4" width="5.2" height="9.2" rx="2.6" fill="currentColor" />
      <path d="M25.6 24.6c0 2.6-2.2 4.2-5.4 4.2h-2.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="17.3" cy="28.8" r="1.7" fill="currentColor" />
      <path d="M16 21.4c-2.9-1.9-4.4-3.4-4.4-5.1 0-1.4 1.1-2.4 2.4-2.4.8 0 1.6.4 2 1.1.4-.7 1.2-1.1 2-1.1 1.3 0 2.4 1 2.4 2.4 0 1.7-1.5 3.2-4.4 5.1z" fill="currentColor" />
    </svg>
  );
}
