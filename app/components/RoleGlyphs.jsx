// Custom role artwork for the sign-up picker: a customer, a salon storefront
// and an artist's brush. Drawn on a 48-unit grid, two-tone, no outlines.
const SPARK = "M0-5c.6 3.2 1.8 4.4 5 5-3.2.6-4.4 1.8-5 5-.6-3.2-1.8-4.4-5-5 3.2-.6 4.4-1.8 5-5z";

function Client() {
  return (
    <>
      <path d="M12 28c0-10 4.6-17 12-17s12 7 12 17v6H12z" fill="#D63E6B" />
      <path d="M8 44c.8-7.4 7-11 16-11s15.2 3.6 16 11z" fill="#F29BB5" />
      <path d="M20 31h8v5a4 4 0 0 1-8 0z" fill="#F4C9B4" />
      <ellipse cx="24" cy="24" rx="8" ry="9" fill="#FFE1CF" />
      <path d="M15.6 23.5c5.4-.4 9.4-3.2 11.2-7.6 2.6 1.6 4.6 4 5.6 7.6-1.2-5.6-4.6-9-8.4-9s-7.2 3.6-8.4 9z" fill="#D63E6B" />
      <circle cx="20.6" cy="25" r="1.1" fill="#7A2A40" />
      <circle cx="27.4" cy="25" r="1.1" fill="#7A2A40" />
      <path d="M21.6 29.2c1.4 1.2 3.4 1.2 4.8 0" stroke="#C4566F" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d={SPARK} fill="#F4B63F" transform="translate(39 10)" />
    </>
  );
}

function Salon() {
  return (
    <>
      <path d="M11 8h26l3 6H8z" fill="#E27C1F" />
      <path d="M8 14h8v4a4 4 0 0 1-8 0z" fill="#E27C1F" />
      <path d="M16 14h8v4a4 4 0 0 1-8 0z" fill="#FFC27A" />
      <path d="M24 14h8v4a4 4 0 0 1-8 0z" fill="#E27C1F" />
      <path d="M32 14h8v4a4 4 0 0 1-8 0z" fill="#FFC27A" />
      <rect x="10" y="22" width="28" height="19" rx="2" fill="#FFFFFF" />
      <rect x="6" y="40" width="36" height="3" rx="1.5" fill="#B85F12" />
      <path d="M14 41V31a4.5 4.5 0 0 1 9 0v10z" fill="#E27C1F" />
      <circle cx="21" cy="35.5" r=".9" fill="#FFF3E0" />
      <rect x="27" y="26" width="8" height="9" rx="4" fill="#FFD9A8" />
    </>
  );
}

function Artist() {
  return (
    <>
      <g transform="rotate(38 24 24)">
        <rect x="20.5" y="3" width="7" height="22" rx="3.5" fill="#3F6FD0" />
        <rect x="20.5" y="9" width="7" height="3" fill="#6F97E8" />
        <rect x="19.5" y="24" width="9" height="6" rx="1" fill="#C7D2E4" />
        <path d="M19.5 30h9c0 6.4-2 10.4-4.5 13-2.5-2.6-4.5-6.6-4.5-13z" fill="#E54B79" />
      </g>
      <path d="M6 42c3.2-3.4 6.4 1.6 10-.4" stroke="#E54B79" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d={SPARK} fill="#F4B63F" transform="translate(11 12)" />
      <path d={SPARK} fill="#8FB1F0" transform="translate(40 30) scale(.6)" />
    </>
  );
}

const GLYPHS = { client: Client, salon: Salon, artist: Artist };

export function RoleGlyph({ id, size = 34 }) {
  const Glyph = GLYPHS[id] || Client;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <Glyph />
    </svg>
  );
}
