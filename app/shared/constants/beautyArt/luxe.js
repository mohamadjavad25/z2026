// "Luxe" service icon pack -- 128x128 canvas, no tile, no outline.
// Every icon is lit the same way (soft light from the top-left), uses one
// shared jewel-tone gradient palette and sits on the same soft floor shadow,
// so the whole set reads as one family of small glossy objects.
// Each entry is the inner SVG; LUXE_DEFS is prepended by beautyEmoji.js.

const stops = (list) => list
  .map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}"${opacity === 1 ? "" : ` stop-opacity="${opacity}"`}/>`)
  .join("");

const lin = (id, list, x1 = 0.15, y1 = 0, x2 = 0.85, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;

const rad = (id, list, cx = 0.35, cy = 0.3, r = 0.8) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;

export const LUXE_DEFS = `<defs>${[
  lin("rose", [[0, "#FFD6E3"], [0.45, "#FF7FA8"], [1, "#DE2F6E"]]),
  lin("roseDeep", [[0, "#FF6F9C"], [1, "#A9174F"]]),
  lin("gold", [[0, "#FFF4CF"], [0.45, "#F6C657"], [1, "#BF7F17"]]),
  lin("goldDeep", [[0, "#F2BA48"], [1, "#9A5F0C"]]),
  lin("plum", [[0, "#EEDDFF"], [0.5, "#B58AFA"], [1, "#6A35D6"]]),
  lin("peach", [[0, "#FFF0E6"], [0.55, "#FCCDB3"], [1, "#EDA584"]]),
  lin("mint", [[0, "#DCFCF1"], [0.5, "#63D7B8"], [1, "#139B7E"]]),
  lin("sky", [[0, "#E6F4FF"], [0.5, "#82C0FF"], [1, "#2F78E6"]]),
  lin("ink", [[0, "#6E5C69"], [1, "#1F161D"]]),
  lin("pearl", [[0, "#FFFFFF"], [0.6, "#F3ECF3"], [1, "#D6CAD8"]]),
  lin("chrome", [[0, "#FFFFFF"], [0.5, "#DCE1EA"], [1, "#8D96A6"]]),
  lin("brown", [[0, "#D9A27A"], [0.5, "#A8693F"], [1, "#5A311C"]]),
  lin("blond", [[0, "#FFF0C8"], [0.5, "#EDC27A"], [1, "#B9812F"]]),
  lin("glass", [[0, "#FFFFFF", 0.95], [1, "#FFFFFF", 0.35]]),
  lin("shine", [[0, "#FFFFFF", 0.85], [1, "#FFFFFF", 0]], 0, 0, 0, 1),
  lin("beam", [[0, "#C9A6FF", 0.95], [1, "#C9A6FF", 0]], 0, 0, 1, 0),
  rad("floor", [[0, "#2A1B28", 0.22], [1, "#2A1B28", 0]], 0.5, 0.5, 0.5),
  rad("glow", [[0, "#FFE7A3", 0.9], [1, "#FFE7A3", 0]], 0.5, 0.5, 0.5),
  rad("blush", [[0, "#FF8FB1", 0.55], [1, "#FF8FB1", 0]], 0.5, 0.5, 0.5)
].join("")}</defs>`;

// ── tiny drawing helpers ─────────────────────────────────────────────────
const floor = (cx = 64, rx = 38, cy = 114) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="6" fill="url(#floor)"/>`;
const shine = (d, opacity = 0.75) => `<path d="${d}" fill="#fff" opacity="${opacity}"/>`;
const stroke = (d, color, width, extra = "") =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
// four-point twinkle
const star = (x, y, r, fill = "url(#gold)") =>
  `<path d="M${x} ${y - r}C${x + r * 0.16} ${y - r * 0.16} ${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y}C${x + r * 0.16} ${y + r * 0.16} ${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r}C${x - r * 0.16} ${y + r * 0.16} ${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y}C${x - r * 0.16} ${y - r * 0.16} ${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z" fill="${fill}"/>`;
const dot = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const rot = (deg, cx, cy, inner) => `<g transform="rotate(${deg} ${cx} ${cy})">${inner}</g>`;

// shared parts
const nailShape = (x, y, w, h, fill = "url(#rose)") => {
  const r = w / 2;
  return `<path d="M${x} ${y + h}V${y + r * 1.1}C${x} ${y - r * 0.25} ${x + w} ${y - r * 0.25} ${x + w} ${y + r * 1.1}V${y + h}Z" fill="${fill}"/>`;
};

const eyeOpen = (iris = "url(#plum)") => `
  <path d="M18 70C34 46 94 46 110 70C94 92 34 92 18 70Z" fill="url(#pearl)"/>
  <circle cx="64" cy="70" r="17" fill="${iris}"/>
  <circle cx="64" cy="70" r="8" fill="#241A22"/>
  <circle cx="58" cy="64" r="4.5" fill="#fff"/>
  ${stroke("M18 70C34 46 94 46 110 70", "url(#ink)", 5)}`;

const brow = (fill = "url(#brown)") =>
  `<path d="M16 66C30 40 66 30 108 44C110 45 110 49 107 49C74 42 44 48 22 70C19 73 14 70 16 66Z" fill="${fill}"/>`;

const syringe = (liquid = "url(#sky)") => `
  <rect x="40" y="30" width="26" height="62" rx="7" fill="url(#glass)" stroke="#D9DFE9" stroke-width="2"/>
  <rect x="44" y="56" width="18" height="32" rx="4" fill="${liquid}"/>
  <rect x="36" y="88" width="34" height="8" rx="4" fill="url(#chrome)"/>
  <rect x="48" y="12" width="10" height="20" rx="3" fill="url(#chrome)"/>
  <rect x="38" y="6" width="30" height="8" rx="4" fill="url(#roseDeep)"/>
  <path d="M51.5 96H54.5L53.6 118H52.4Z" fill="url(#chrome)"/>
  ${shine("M45 34h5v52h-5z", 0.7)}`;

export default {
  // ── hair ───────────────────────────────────────────────────────────────
  haircut: `${floor(64, 34)}
    ${rot(-20, 64, 60, `<path d="M58 64L50 8C49 3 56 1 58 6L72 60Z" fill="url(#chrome)"/>`)}
    ${rot(20, 64, 60, `<path d="M70 64L78 8C79 3 72 1 70 6L56 60Z" fill="url(#chrome)"/>`)}
    <path fill-rule="evenodd" d="M40 72a19 19 0 1 1 0 38a19 19 0 1 1 0-38Zm0 9a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z" fill="url(#rose)"/>
    <path fill-rule="evenodd" d="M88 72a19 19 0 1 1 0 38a19 19 0 1 1 0-38Zm0 9a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z" fill="url(#rose)"/>
    <path d="M50 76L60 60M78 76L68 60" stroke="url(#roseDeep)" stroke-width="9" stroke-linecap="round"/>
    <circle cx="64" cy="58" r="7" fill="url(#gold)"/>
    ${dot(62, 56, 2, "#fff")}
    ${star(104, 26, 9)}${star(22, 34, 5, "url(#rose)")}`,

  hair_color: `${floor(64, 40)}
    <path d="M20 66H108C108 92 90 108 64 108C38 108 20 92 20 66Z" fill="url(#rose)"/>
    <ellipse cx="64" cy="66" rx="44" ry="10" fill="url(#plum)"/>
    <path d="M32 64C40 58 54 62 62 58C72 54 82 60 96 62" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>
    ${rot(40, 84, 40, `<rect x="80" y="2" width="9" height="58" rx="4.5" fill="url(#ink)"/><rect x="76" y="56" width="17" height="10" rx="3" fill="url(#gold)"/><path d="M77 66H92L90 82H79Z" fill="url(#plum)"/>`)}
    ${shine("M28 74C32 90 44 100 58 102C46 96 36 86 34 74Z", 0.55)}
    ${star(22, 30, 7)}`,

  highlights: `${floor(64, 34)}
    ${stroke("M38 10C30 34 50 50 40 74C32 92 40 104 46 110", "url(#brown)", 15)}
    ${stroke("M62 8C54 34 74 52 64 76C56 94 64 104 70 110", "url(#blond)", 15)}
    ${stroke("M86 10C78 34 98 50 88 74C80 92 88 104 94 110", "url(#brown)", 15)}
    ${stroke("M58 18C56 30 64 40 64 52", "#fff", 3, 'stroke-opacity="0.7"')}
    ${stroke("M34 20C32 30 38 38 40 46", "#fff", 3, 'stroke-opacity="0.35"')}
    ${star(108, 24, 9)}${star(20, 46, 5)}`,

  blowdry: `${floor(58, 36)}
    <path d="M56 70H76L84 108C85 112 82 114 78 114H66C62 114 60 112 59 108Z" fill="url(#roseDeep)"/>
    <rect x="16" y="28" width="76" height="46" rx="23" fill="url(#rose)"/>
    <path d="M86 34L112 30C116 30 118 32 118 36V66C118 70 116 72 112 72L86 68Z" fill="url(#ink)"/>
    <circle cx="38" cy="51" r="13" fill="url(#pearl)"/>
    <circle cx="38" cy="51" r="6" fill="url(#rose)"/>
    ${shine("M28 34H70C74 34 74 40 70 40H28C24 40 24 34 28 34Z", 0.6)}
    <rect x="62" y="84" width="16" height="5" rx="2.5" fill="#fff" opacity="0.6"/>`,

  updo: `${floor(64, 30)}
    <circle cx="64" cy="26" r="17" fill="url(#brown)"/>
    <path d="M50 22C56 14 70 12 78 20" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
    <rect x="48" y="38" width="32" height="8" rx="4" fill="url(#gold)"/>
    <path d="M28 76C28 50 44 40 64 40C84 40 100 50 100 76C100 82 96 84 92 82C88 74 80 66 64 66C48 66 40 74 36 82C32 84 28 82 28 76Z" fill="url(#brown)"/>
    <path d="M38 80C38 64 50 58 64 58C78 58 90 64 90 80C90 98 78 110 64 110C50 110 38 98 38 80Z" fill="url(#peach)"/>
    <path d="M36 82C40 68 50 62 64 62C78 62 88 68 92 82C86 74 76 70 64 70C52 70 42 74 36 82Z" fill="url(#brown)"/>
    <circle cx="48" cy="92" r="7" fill="url(#blush)"/><circle cx="80" cy="92" r="7" fill="url(#blush)"/>
    ${star(100, 22, 8)}${dot(88, 14, 3, "url(#rose)")}`,

  keratin: `${floor(64, 28)}
    <rect x="54" y="8" width="20" height="16" rx="4" fill="url(#ink)"/>
    <rect x="58" y="22" width="12" height="8" fill="url(#gold)"/>
    <path d="M44 38C44 32 50 28 56 28H72C78 28 84 32 84 38V104C84 109 80 112 75 112H53C48 112 44 109 44 104Z" fill="url(#gold)"/>
    <rect x="49" y="54" width="30" height="36" rx="6" fill="url(#pearl)"/>
    <path d="M64 60C64 60 72 70 72 76C72 80.4 68.4 84 64 84C59.6 84 56 80.4 56 76C56 70 64 60 64 60Z" fill="url(#gold)"/>
    ${shine("M50 34h6v66h-6z", 0.5)}
    ${star(100, 40, 9)}${star(26, 62, 6, "url(#rose)")}`,

  hair_straight: `${floor(64, 34)}
    ${rot(-14, 64, 100, `<rect x="40" y="10" width="20" height="100" rx="10" fill="url(#ink)"/><rect x="45" y="16" width="10" height="44" rx="5" fill="url(#rose)"/>`)}
    ${rot(14, 64, 100, `<rect x="68" y="10" width="20" height="100" rx="10" fill="url(#ink)"/><rect x="73" y="16" width="10" height="44" rx="5" fill="url(#rose)"/>`)}
    <circle cx="64" cy="98" r="9" fill="url(#gold)"/>
    ${dot(61, 95, 2.5, "#fff")}
    ${stroke("M100 30c6 4 6 10 0 14s-6 10 0 14", "url(#plum)", 3)}${stroke("M110 40c5 3 5 8 0 11", "url(#plum)", 3)}`,

  braid: `${floor(64, 24)}
    ${[0, 1, 2, 3, 4].map((i) => {
      const y = 22 + i * 16;
      const s = 1 - i * 0.06;
      return `${rot(32, 56, y, `<ellipse cx="56" cy="${y}" rx="${15 * s}" ry="${9.5 * s}" fill="url(#brown)"/><ellipse cx="52" cy="${y - 3}" rx="${7 * s}" ry="${2.2 * s}" fill="#fff" opacity="0.35"/>`)}${rot(-32, 72, y + 8, `<ellipse cx="72" cy="${y + 8}" rx="${15 * s}" ry="${9.5 * s}" fill="url(#blond)"/><ellipse cx="68" cy="${y + 5}" rx="${7 * s}" ry="${2.2 * s}" fill="#fff" opacity="0.45"/>`)}`;
    }).join("")}
    <rect x="54" y="96" width="20" height="9" rx="4.5" fill="url(#rose)"/>
    <path d="M58 104L55 116M64 105V118M70 104L73 116" stroke="url(#brown)" stroke-width="4" stroke-linecap="round"/>
    ${star(102, 24, 8)}${star(24, 50, 5, "url(#rose)")}`,

  // ── makeup ─────────────────────────────────────────────────────────────
  lipstick: `${floor(64, 26)}
    <path d="M50 46V24C50 18 54 12 60 8L78 2V46Z" fill="url(#roseDeep)"/>
    ${shine("M55 24C55 20 57 17 60 15V44h-5Z", 0.5)}
    <rect x="46" y="44" width="36" height="14" rx="3" fill="url(#gold)"/>
    <rect x="40" y="58" width="48" height="54" rx="8" fill="url(#ink)"/>
    <rect x="40" y="70" width="48" height="5" fill="url(#goldDeep)"/>
    ${shine("M46 62h6v46h-6z", 0.25)}
    ${star(102, 24, 9)}${star(22, 44, 6, "url(#rose)")}`,

  eyeshadow: `${floor(64, 42)}
    <path d="M18 54L26 14C27 10 30 8 34 8H94C98 8 101 10 102 14L110 54Z" fill="url(#ink)"/>
    <path d="M26 50L32 18C33 15 35 14 37 14H91C93 14 95 15 96 18L102 50Z" fill="url(#chrome)"/>
    ${shine("M40 18L34 46H44L52 18Z", 0.6)}
    <rect x="14" y="56" width="100" height="52" rx="12" fill="url(#ink)"/>
    <circle cx="36" cy="72" r="10" fill="url(#rose)"/><circle cx="64" cy="72" r="10" fill="url(#gold)"/><circle cx="92" cy="72" r="10" fill="url(#plum)"/>
    <circle cx="36" cy="95" r="9" fill="url(#peach)"/><circle cx="64" cy="95" r="9" fill="url(#roseDeep)"/><circle cx="92" cy="95" r="9" fill="url(#brown)"/>
    ${[36, 64, 92].map((x) => dot(x - 4, 68, 2.5, "#fff")).join("")}`,

  makeup_brush: `${floor(60, 34)}
    ${rot(-40, 64, 64, `
      <rect x="57" y="62" width="14" height="58" rx="7" fill="url(#ink)"/>
      <path d="M54 44H74L72 66H56Z" fill="url(#gold)"/>
      <path d="M50 46C46 30 52 8 64 4C76 8 82 30 78 46Z" fill="url(#peach)"/>
      <path d="M50 46C50 36 54 26 58 22C58 30 60 38 64 46Z" fill="url(#rose)" opacity="0.8"/>
      ${shine("M60 12C56 20 55 30 56 40h4C59 30 60 20 62 14Z", 0.6)}`)}
    ${dot(96, 24, 5, "url(#rose)")}${dot(106, 40, 3.5, "url(#gold)")}${star(88, 14, 6)}${dot(102, 56, 2.5, "url(#rose)")}`,

  lips: `${floor(64, 40)}
    <path d="M12 64C26 44 42 34 54 40C58 42 61 44 64 44C67 44 70 42 74 40C86 34 102 44 116 64C102 66 82 64 64 64C46 64 26 66 12 64Z" fill="url(#roseDeep)"/>
    <path d="M12 64C30 68 46 68 64 68C82 68 98 68 116 64C104 90 86 102 64 102C42 102 24 90 12 64Z" fill="url(#rose)"/>
    <path d="M12 64C30 70 48 72 64 70C80 72 98 70 116 64" fill="none" stroke="#A9174F" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    ${shine("M44 78C52 76 60 77 66 80C58 84 50 84 44 78Z", 0.75)}
    ${shine("M40 48C46 44 52 44 56 47C50 48 46 50 40 52Z", 0.5)}
    ${star(108, 30, 8)}`,

  eyeliner: `${floor(64, 40)}
    ${stroke("M14 84C38 98 72 98 98 82L118 62", "url(#ink)", 7)}
    ${[24, 38, 52, 66, 80].map((x, i) => stroke(`M${x} ${90 + (i === 2 ? 4 : i % 2 ? 3 : 0)}l-${4 - i} 12`, "#241A22", 3)).join("")}
    ${rot(42, 72, 40, `<rect x="66" y="-4" width="13" height="64" rx="6.5" fill="url(#ink)"/><rect x="66" y="14" width="13" height="6" fill="url(#gold)"/><path d="M68 60H77L72.5 80Z" fill="#241A22"/>`)}
    ${star(28, 30, 9)}${star(44, 16, 5, "url(#rose)")}`,

  party_makeup: `${floor(64, 34)}
    <circle cx="64" cy="40" r="30" fill="url(#gold)"/>
    <circle cx="64" cy="40" r="23" fill="url(#chrome)"/>
    ${shine("M50 26C56 20 66 18 74 22L50 50C46 42 46 32 50 26Z", 0.7)}
    <ellipse cx="64" cy="86" rx="34" ry="24" fill="url(#goldDeep)"/>
    <ellipse cx="64" cy="82" rx="34" ry="22" fill="url(#gold)"/>
    <ellipse cx="64" cy="82" rx="24" ry="14" fill="url(#rose)"/>
    ${shine("M48 78C54 72 64 70 72 72C64 74 56 78 52 84Z", 0.55)}
    ${star(108, 22, 10)}${star(18, 30, 7, "url(#rose)")}${star(104, 56, 5, "url(#plum)")}`,

  // ── bridal ─────────────────────────────────────────────────────────────
  bridal: `${floor(64, 40)}
    <path d="M64 20C40 22 30 46 26 70C22 92 18 104 12 110H116C110 104 106 92 102 70C98 46 88 22 64 20Z" fill="url(#pearl)" opacity="0.95"/>
    <path d="M64 30C50 32 44 50 42 70C40 90 38 100 34 110H94C90 100 88 90 86 70C84 50 78 32 64 30Z" fill="#fff" opacity="0.65"/>
    <path d="M36 28C44 14 84 14 92 28C80 22 48 22 36 28Z" fill="url(#gold)"/>
    <path d="M42 22L48 10L54 20L64 4L74 20L80 10L86 22C76 18 52 18 42 22Z" fill="url(#gold)"/>
    <circle cx="64" cy="14" r="4" fill="url(#rose)"/>${dot(48, 16, 2.5, "url(#sky)")}${dot(80, 16, 2.5, "url(#sky)")}
    ${star(108, 30, 8)}${star(18, 52, 6, "url(#rose)")}`,

  crown: `${floor(64, 40)}
    <path d="M18 44L40 64L64 26L88 64L110 44L102 96H26Z" fill="url(#gold)"/>
    <rect x="24" y="92" width="80" height="16" rx="5" fill="url(#goldDeep)"/>
    <circle cx="18" cy="42" r="7" fill="url(#gold)"/><circle cx="110" cy="42" r="7" fill="url(#gold)"/><circle cx="64" cy="22" r="8" fill="url(#gold)"/>
    <path d="M64 58L74 72L64 86L54 72Z" fill="url(#rose)"/>
    <circle cx="38" cy="80" r="5" fill="url(#sky)"/><circle cx="90" cy="80" r="5" fill="url(#plum)"/>
    ${shine("M32 60L44 74L40 92H34Z", 0.35)}${dot(61, 66, 2.5, "#fff")}
    ${star(104, 16, 8, "url(#rose)")}`,

  ring: `${floor(64, 30)}
    <path fill-rule="evenodd" d="M64 46a33 33 0 1 1 0 66a33 33 0 1 1 0-66Zm0 11a22 22 0 1 0 0 44a22 22 0 1 0 0-44Z" fill="url(#gold)"/>
    ${shine("M36 70C38 60 46 52 56 49C48 56 42 64 40 74Z", 0.6)}
    <path d="M46 34L54 20H74L82 34L64 52Z" fill="url(#sky)"/>
    <path d="M46 34H82L64 52Z" fill="#2F78E6" opacity="0.35"/>
    <path d="M54 20L60 34L64 20L68 34L74 20" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="2"/>
    ${star(100, 18, 9)}${star(26, 26, 6)}`,

  bouquet: `${floor(64, 28)}
    <path d="M24 46L44 40L56 54Z" fill="url(#mint)"/><path d="M104 46L84 40L72 54Z" fill="url(#mint)"/>
    <path d="M42 60H86L68 116H60Z" fill="url(#pearl)"/>
    <path d="M52 84C58 80 70 80 76 84L72 92C66 88 62 88 56 92Z" fill="url(#rose)"/>
    ${[[44, 38, 16], [84, 38, 16], [64, 26, 18], [64, 52, 14]].map(([x, y, r]) => `
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#rose)"/>
      <path d="M${x - r * 0.5} ${y}C${x - r * 0.5} ${y - r * 0.6} ${x + r * 0.5} ${y - r * 0.6} ${x + r * 0.4} ${y + r * 0.1}C${x + r * 0.3} ${y + r * 0.5} ${x - r * 0.1} ${y + r * 0.4} ${x - r * 0.05} ${y + r * 0.05}" fill="none" stroke="#A9174F" stroke-width="2.6" stroke-linecap="round" opacity="0.55"/>
      ${dot(x - r * 0.45, y - r * 0.45, r * 0.18, "#fff")}`).join("")}
    ${star(110, 20, 7)}`,

  // ── brows & lashes ─────────────────────────────────────────────────────
  eyebrow: `${floor(64, 40)}
    ${brow()}
    ${shine("M36 54C52 42 74 38 96 42C74 42 54 46 40 58Z", 0.35)}
    ${rot(-30, 80, 88, `<path d="M58 80L106 74C108 74 108 78 106 78L60 84Z" fill="url(#chrome)"/><path d="M58 84L106 94C108 95 107 98 105 98L58 88Z" fill="url(#chrome)"/><rect x="50" y="78" width="14" height="12" rx="4" fill="url(#rose)"/>`)}
    ${star(104, 18, 8)}`,

  lash_ext: `${floor(64, 40)}
    ${[22, 32, 42, 52, 60, 68, 76, 86, 96, 106].map((x) => {
      const t = (x - 64) / 50;
      const y = 58 + 17 * (1 - t * t);
      const len = 20 + 10 * (1 - Math.abs(t));
      return stroke(`M${x} ${y}Q${x + t * 4} ${y + len * 0.6} ${x + t * 16} ${y + len}`, "#241A22", 3.4);
    }).join("")}
    <path d="M14 56C34 80 94 80 114 56" fill="none" stroke="url(#ink)" stroke-width="7" stroke-linecap="round"/>
    <path d="M26 54C44 66 84 66 102 54" fill="none" stroke="url(#peach)" stroke-width="5" stroke-linecap="round"/>
    ${star(100, 24, 9)}${star(30, 30, 6, "url(#rose)")}`,

  lash_lift: `${floor(64, 40)}
    ${eyeOpen("url(#plum)")}
    ${[[24, 60, -40], [34, 54, -28], [46, 50, -14], [58, 48, -4], [70, 48, 4], [82, 50, 14], [94, 54, 28], [104, 60, 40]].map(([x, y, a]) =>
      rot(a, x, y, stroke(`M${x} ${y}C${x} ${y - 14} ${x + 8} ${y - 22} ${x + 12} ${y - 18}`, "#241A22", 3.6))).join("")}
    ${star(110, 92, 7)}${star(18, 94, 5, "url(#rose)")}`,

  brow_lamination: `${floor(64, 40)}
    ${brow()}
    ${[30, 42, 54, 66, 78, 90].map((x, i) => stroke(`M${x} ${66 - i * 3}l6 -${14 - i}`, "#fff", 2.2, 'stroke-opacity="0.45"')).join("")}
    ${rot(-35, 74, 92, `<rect x="38" y="88" width="46" height="9" rx="4.5" fill="url(#ink)"/><rect x="84" y="80" width="30" height="24" rx="12" fill="url(#plum)"/>${[88, 94, 100, 106].map((x) => `<rect x="${x}" y="78" width="2.6" height="28" rx="1.3" fill="#fff" opacity="0.55"/>`).join("")}`)}
    ${star(108, 18, 8)}`,

  threading: `${floor(64, 40)}
    ${brow()}
    ${stroke("M14 106L64 82L114 106", "url(#roseDeep)", 3)}
    ${stroke("M14 90L64 82L114 90", "url(#rose)", 3)}
    <ellipse cx="64" cy="82" rx="9" ry="6" fill="url(#rose)"/>${dot(61, 80, 2, "#fff")}
    ${star(28, 24, 7)}`,

  permanent_makeup: `${floor(64, 40)}
    ${brow("url(#brown)")}
    ${[24, 34, 44, 54, 64, 74, 84, 94].map((x, i) => stroke(`M${x} ${68 - i * 3.2}l8 -${10 - i * 0.6}`, "#5A311C", 2.4)).join("")}
    ${rot(-40, 80, 90, `<rect x="42" y="84" width="54" height="14" rx="7" fill="url(#pearl)"/><rect x="42" y="84" width="16" height="14" rx="7" fill="url(#rose)"/><path d="M96 86L114 91L96 96Z" fill="url(#chrome)"/>`)}
    ${star(108, 18, 8)}`,

  // ── nails ──────────────────────────────────────────────────────────────
  manicure: `${floor(64, 36)}
    <path d="M26 120V62C26 56 30 52 36 52C42 52 46 56 46 62V120Z" fill="url(#peach)"/>
    <path d="M48 120V36C48 30 52 26 58 26C64 26 68 30 68 36V120Z" fill="url(#peach)"/>
    <path d="M70 120V30C70 24 74 20 80 20C86 20 90 24 90 30V120Z" fill="url(#peach)"/>
    <path d="M92 120V44C92 38 96 34 102 34C108 34 112 38 112 44V120Z" fill="url(#peach)"/>
    ${nailShape(30, 55, 12, 18)}${nailShape(52, 29, 12, 20)}${nailShape(74, 23, 12, 20)}${nailShape(96, 37, 12, 18)}
    ${[[33, 60], [55, 34], [77, 28], [99, 42]].map(([x, y]) => `<rect x="${x}" y="${y}" width="3" height="9" rx="1.5" fill="#fff" opacity="0.75"/>`).join("")}
    ${star(18, 30, 8)}`,

  pedicure: `${floor(64, 40)}
    <path d="M30 116C24 96 26 70 38 58C52 44 80 44 94 56C106 66 108 88 100 116Z" fill="url(#peach)"/>
    ${[[34, 48, 11], [54, 36, 12], [74, 34, 11], [92, 40, 9.5], [106, 52, 8]].map(([x, y, r]) => `
      <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="url(#peach)"/>
      <ellipse cx="${x}" cy="${y - r * 0.35}" rx="${r * 0.62}" ry="${r * 0.68}" fill="url(#rose)"/>
      ${dot(x - r * 0.25, y - r * 0.6, r * 0.16, "#fff")}`).join("")}
    ${shine("M40 70C46 62 56 58 66 58C58 64 50 72 46 84Z", 0.45)}`,

  nail_polish: `${floor(64, 28)}
    <rect x="52" y="4" width="24" height="40" rx="6" fill="url(#ink)"/>
    ${shine("M56 8h4v32h-4z", 0.3)}
    <rect x="48" y="40" width="32" height="10" rx="3" fill="url(#gold)"/>
    <path d="M34 66C34 56 42 50 52 50H76C86 50 94 56 94 66V100C94 108 88 112 80 112H48C40 112 34 108 34 100Z" fill="url(#rose)"/>
    ${shine("M40 64C40 58 44 56 50 56V104H44C42 104 40 102 40 98Z", 0.55)}
    <path d="M58 72C58 72 54 80 54 84C54 88 58 92 64 92C70 92 74 88 74 84C74 80 70 72 70 72Z" fill="#fff" opacity="0.35"/>
    ${star(106, 30, 9)}${star(22, 44, 6)}`,

  gel_nails: `${floor(64, 44)}
    <path d="M12 100C12 54 36 30 64 30C92 30 116 54 116 100Z" fill="url(#pearl)"/>
    <path d="M28 100C28 66 44 48 64 48C84 48 100 66 100 100Z" fill="url(#plum)"/>
    <path d="M30 100C32 80 42 64 64 62C86 64 96 80 98 100Z" fill="url(#glow)" opacity="0.9"/>
    <rect x="8" y="98" width="112" height="12" rx="6" fill="url(#ink)"/>
    <rect x="52" y="36" width="24" height="6" rx="3" fill="url(#plum)"/>
    ${shine("M22 82C24 60 36 44 54 38C40 50 32 64 30 84Z", 0.7)}
    ${nailShape(58, 74, 12, 24)}`,

  nail_art: `${floor(64, 30)}
    <path d="M40 118V54C40 30 52 12 64 6C76 12 88 30 88 54V118Z" fill="url(#plum)"/>
    <path d="M40 80C52 74 76 74 88 80V118H40Z" fill="url(#rose)"/>
    ${stroke("M40 80C52 74 76 74 88 80", "url(#gold)", 4)}
    ${star(64, 46, 11)}${dot(54, 26, 3, "url(#gold)")}${dot(76, 64, 3, "url(#gold)")}${dot(52, 96, 3.5, "#fff")}${dot(72, 102, 2.5, "#fff")}
    ${shine("M46 52C46 38 52 26 58 20C54 30 52 42 52 56Z", 0.55)}
    ${star(106, 30, 8)}${star(20, 56, 6, "url(#rose)")}`,

  french_nails: `${floor(64, 30)}
    <path d="M40 118V54C40 30 52 12 64 6C76 12 88 30 88 54V118Z" fill="url(#peach)"/>
    <path d="M40 118V54C40 50 41 46 42 42C50 50 78 50 86 42C87 46 88 50 88 54V118Z" fill="url(#rose)" opacity="0.55"/>
    <path d="M42 42C46 26 54 14 64 6C74 14 82 26 86 42C78 50 50 50 42 42Z" fill="url(#pearl)"/>
    ${shine("M46 60C46 54 48 50 50 48V108H46Z", 0.5)}
    ${star(106, 28, 9)}${star(22, 40, 6)}`,

  // ── skin ───────────────────────────────────────────────────────────────
  facial: `${floor(64, 34)}
    <path d="M22 56C22 26 42 12 64 12C86 12 106 26 106 56C96 46 82 42 64 42C46 42 32 46 22 56Z" fill="url(#pearl)"/>
    <path d="M28 62C28 46 44 40 64 40C84 40 100 46 100 62C100 92 84 112 64 112C44 112 28 92 28 62Z" fill="url(#peach)"/>
    <path d="M22 56C32 44 46 40 64 40C82 40 96 44 106 56C96 52 82 50 64 50C46 50 32 52 22 56Z" fill="url(#pearl)"/>
    <circle cx="48" cy="70" r="11" fill="url(#mint)"/><circle cx="80" cy="70" r="11" fill="url(#mint)"/>
    <circle cx="48" cy="70" r="6" fill="#DCFCF1"/><circle cx="80" cy="70" r="6" fill="#DCFCF1"/>
    <circle cx="44" cy="88" r="7" fill="url(#blush)"/><circle cx="84" cy="88" r="7" fill="url(#blush)"/>
    ${stroke("M56 96C60 100 68 100 72 96", "#C46A55", 3)}
    ${star(110, 28, 8)}`,

  hydrafacial: `${floor(64, 30)}
    <path d="M64 8C64 8 102 50 102 76C102 97 85 114 64 114C43 114 26 97 26 76C26 50 64 8 64 8Z" fill="url(#sky)"/>
    ${shine("M44 70C44 56 52 42 60 32C56 46 54 60 54 74C54 82 50 86 46 84C44 82 44 76 44 70Z", 0.7)}
    <path d="M54 86C56 94 62 98 72 98" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="4" stroke-linecap="round"/>
    ${dot(108, 40, 6, "url(#sky)")}${dot(20, 52, 4, "url(#sky)")}${star(100, 18, 8)}`,

  peeling: `${floor(64, 36)}
    <circle cx="64" cy="62" r="44" fill="url(#rose)"/>
    <path d="M108 62A44 44 0 1 0 64 106Q72 70 108 62Z" fill="url(#peach)"/>
    <path d="M64 106Q72 70 108 62Q94 74 90 88Q84 102 64 106Z" fill="url(#pearl)"/>
    <path d="M70 98Q78 78 98 70" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    ${shine("M34 40C40 30 50 24 62 22C50 30 42 38 38 50Z", 0.6)}
    ${star(18, 108, 7)}${star(110, 16, 8)}`,

  microneedling: `${floor(60, 32)}
    ${rot(-40, 64, 64, `
      <rect x="52" y="4" width="24" height="84" rx="12" fill="url(#pearl)"/>
      <rect x="52" y="30" width="24" height="10" fill="url(#sky)"/>
      <rect x="56" y="86" width="16" height="12" rx="3" fill="url(#chrome)"/>
      <rect x="58" y="98" width="12" height="6" rx="2" fill="url(#ink)"/>
      ${[60, 64, 68].map((x) => `<rect x="${x - 0.8}" y="104" width="1.6" height="8" fill="#8D96A6"/>`).join("")}
      ${shine("M56 10h4v70h-4z", 0.6)}`)}
    ${[[96, 96], [106, 88], [102, 106], [112, 100], [92, 108]].map(([x, y]) => dot(x, y, 2.6, "url(#rose)")).join("")}
    ${star(26, 28, 8)}`,

  face_mask: `${floor(64, 32)}
    <path d="M24 50C24 24 42 10 64 10C86 10 104 24 104 50C104 84 88 112 64 112C40 112 24 84 24 50Z" fill="url(#pearl)"/>
    <path fill-rule="evenodd" d="M24 50C24 24 42 10 64 10C86 10 104 24 104 50C104 84 88 112 64 112C40 112 24 84 24 50ZM36 52C38 46 48 44 54 50C48 56 40 58 36 52ZM92 52C90 46 80 44 74 50C80 56 88 58 92 52ZM50 88C56 92 72 92 78 88C74 96 54 96 50 88Z" fill="url(#mint)" opacity="0.55"/>
    <path d="M36 52C38 46 48 44 54 50C48 56 40 58 36 52ZM92 52C90 46 80 44 74 50C80 56 88 58 92 52Z" fill="url(#peach)"/>
    <path d="M50 88C56 92 72 92 78 88C74 96 54 96 50 88Z" fill="url(#rose)"/>
    ${shine("M34 36C38 24 48 16 60 14C50 22 42 30 38 44Z", 0.7)}
    ${star(110, 24, 8)}${star(18, 84, 6, "url(#mint)")}`,

  skincare: `${floor(64, 38)}
    <rect x="22" y="22" width="84" height="28" rx="10" fill="url(#rose)"/>
    ${shine("M30 28H96C98 28 98 32 96 32H30C28 32 28 28 30 28Z", 0.6)}
    <rect x="26" y="46" width="76" height="8" fill="url(#roseDeep)"/>
    <path d="M24 54H104V98C104 106 98 112 90 112H38C30 112 24 106 24 98Z" fill="url(#pearl)"/>
    <path d="M64 66C64 66 76 74 76 84C76 90 70 96 64 96C58 96 52 90 52 84C52 74 64 66 64 66Z" fill="url(#rose)"/>
    ${dot(60, 80, 3, "#fff")}
    ${shine("M30 60h6v44h-6z", 0.7)}
    ${star(112, 18, 8)}${star(14, 34, 6)}`,

  serum: `${floor(64, 26)}
    <path d="M56 10C56 4 72 4 72 10V30H56Z" fill="url(#ink)"/>
    <rect x="52" y="28" width="24" height="12" rx="3" fill="url(#gold)"/>
    <path d="M42 54C42 46 48 40 56 40H72C80 40 86 46 86 54V104C86 109 82 112 77 112H51C46 112 42 109 42 104Z" fill="url(#gold)" opacity="0.92"/>
    <path d="M46 72H82V104C82 107 80 108 77 108H51C48 108 46 107 46 104Z" fill="url(#goldDeep)" opacity="0.7"/>
    ${shine("M48 50C48 46 50 44 54 44V100H48Z", 0.6)}
    <path d="M104 46C104 46 112 56 112 62C112 66.4 108.4 70 104 70C99.6 70 96 66.4 96 62C96 56 104 46 104 46Z" fill="url(#gold)"/>
    ${star(22, 40, 8)}`,

  // ── clinic ─────────────────────────────────────────────────────────────
  injection: `${floor(64, 30)}${rot(40, 64, 64, syringe("url(#sky)"))}${star(104, 24, 8)}${star(24, 98, 6, "url(#sky)")}`,

  filler: `${floor(64, 40)}
    <g transform="translate(0 18)">
      <path d="M14 60C26 42 40 34 52 38C56 40 60 42 64 42C68 42 72 40 76 38C88 34 102 42 114 60C100 62 82 60 64 60C46 60 28 62 14 60Z" fill="url(#roseDeep)"/>
      <path d="M14 60C30 64 46 64 64 64C82 64 98 64 114 60C102 84 86 94 64 94C42 94 26 84 14 60Z" fill="url(#rose)"/>
      ${shine("M46 72C54 70 62 71 68 74C60 78 52 78 46 72Z", 0.75)}
    </g>
    ${rot(55, 92, 32, `<g transform="translate(46 -14) scale(0.62)">${syringe("url(#rose)")}</g>`)}
    ${star(22, 24, 8)}`,

  laser: `${floor(56, 30)}
    <path d="M70 70L118 112H96Z" fill="url(#beam)" opacity="0.8"/>
    ${stroke("M72 70L110 106", "#fff", 3, 'stroke-opacity="0.85"')}
    ${rot(42, 52, 50, `
      <rect x="34" y="10" width="36" height="72" rx="14" fill="url(#pearl)"/>
      <rect x="40" y="80" width="24" height="14" rx="4" fill="url(#ink)"/>
      <rect x="44" y="94" width="16" height="6" rx="3" fill="url(#plum)"/>
      <rect x="44" y="24" width="16" height="10" rx="5" fill="url(#plum)"/>
      ${shine("M40 16h6v58h-6z", 0.6)}`)}
    ${star(112, 74, 8, "url(#plum)")}${star(98, 116, 0.1)}${star(20, 22, 6)}`,

  prp: `${floor(64, 26)}
    ${rot(14, 64, 64, `
      <path d="M48 10H80V96C80 106 72 114 64 114C56 114 48 106 48 96Z" fill="url(#glass)" stroke="#D9DFE9" stroke-width="2"/>
      <path d="M52 40H76V60H52Z" fill="url(#gold)"/>
      <path d="M52 60H76V96C76 104 70 110 64 110C58 110 52 104 52 96Z" fill="url(#roseDeep)"/>
      <rect x="44" y="4" width="40" height="12" rx="5" fill="url(#plum)"/>
      ${shine("M55 44h4v58h-4z", 0.55)}`)}
    ${star(102, 30, 9)}${star(24, 50, 6, "url(#rose)")}`,

  hifu: `${floor(64, 36)}
    <path d="M30 62C30 36 46 20 64 20C82 20 98 36 98 62C98 92 82 112 64 112C46 112 30 92 30 62Z" fill="url(#peach)"/>
    <path d="M26 66C24 34 44 16 64 16C84 16 104 34 102 66C96 50 82 42 64 42C46 42 32 50 26 66Z" fill="url(#brown)"/>
    <path d="M40 30C48 22 60 20 70 22" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
    <circle cx="48" cy="80" r="7" fill="url(#blush)"/><circle cx="82" cy="80" r="7" fill="url(#blush)"/>
    ${stroke("M100 92C110 82 110 62 100 52", "url(#plum)", 5)}
    ${stroke("M110 100C124 84 124 60 110 44", "url(#plum)", 4, 'stroke-opacity="0.6"')}
    <path d="M104 28L114 40H108V50H100V40H94Z" fill="url(#gold)"/>`,

  // ── body & spa ─────────────────────────────────────────────────────────
  waxing: `${floor(64, 40)}
    <path d="M22 62H106V94C106 104 98 112 88 112H40C30 112 22 104 22 94Z" fill="url(#pearl)"/>
    <ellipse cx="64" cy="62" rx="42" ry="10" fill="url(#gold)"/>
    <path d="M30 62C30 74 36 76 38 70C40 64 42 80 46 78C50 76 50 64 54 64" fill="url(#gold)"/>
    ${rot(34, 86, 40, `<rect x="80" y="-2" width="14" height="70" rx="7" fill="url(#brown)"/><path d="M80 54H94V70C94 74 91 77 87 77C83 77 80 74 80 70Z" fill="url(#gold)"/>`)}
    ${shine("M28 74h6v26h-6z", 0.6)}
    ${star(22, 32, 8)}`,

  massage: `${floor(64, 44)}
    <rect x="8" y="88" width="112" height="10" rx="5" fill="url(#ink)"/>
    <path d="M16 88C16 74 26 68 40 68H96C108 68 116 76 116 88Z" fill="url(#pearl)"/>
    <path d="M44 68H96C108 68 114 74 116 82H50Z" fill="url(#mint)"/>
    <circle cx="30" cy="66" r="13" fill="url(#peach)"/>
    <path d="M18 64C18 54 26 50 32 52C40 54 44 60 42 66C36 60 26 58 18 64Z" fill="url(#brown)"/>
    <path d="M60 30C60 30 68 22 76 30C84 22 92 30 92 30C92 40 76 48 76 48C76 48 60 40 60 30Z" fill="url(#rose)"/>
    ${stroke("M48 40c4-4 4-8 0-12M104 40c-4-4-4-8 0-12", "url(#plum)", 3)}`,

  spa: `${floor(64, 44)}
    <ellipse cx="64" cy="98" rx="48" ry="10" fill="url(#sky)" opacity="0.8"/>
    <path d="M64 94C46 92 22 82 14 58C34 56 52 66 64 94Z" fill="url(#rose)"/>
    <path d="M64 94C82 92 106 82 114 58C94 56 76 66 64 94Z" fill="url(#rose)"/>
    <path d="M64 94C46 84 36 62 42 40C56 48 64 70 64 94Z" fill="url(#roseDeep)"/>
    <path d="M64 94C82 84 92 62 86 40C72 48 64 70 64 94Z" fill="url(#roseDeep)"/>
    <path d="M64 94C54 76 54 46 64 22C74 46 74 76 64 94Z" fill="url(#rose)"/>
    ${shine("M60 40C62 32 64 28 64 28C64 44 62 60 62 74C58 64 58 50 60 40Z", 0.6)}
    ${star(104, 24, 8)}${star(24, 30, 6)}`,

  stone_massage: `${floor(64, 40)}
    <ellipse cx="64" cy="100" rx="42" ry="12" fill="url(#ink)"/>
    <ellipse cx="62" cy="80" rx="34" ry="11" fill="url(#ink)"/>
    <ellipse cx="66" cy="62" rx="26" ry="9" fill="url(#ink)"/>
    ${shine("M36 96C46 92 58 92 68 93C56 94 46 96 40 100Z", 0.3)}
    ${shine("M40 78C48 74 58 74 66 75C56 76 50 78 44 82Z", 0.3)}
    ${shine("M48 60C54 57 62 57 68 58C60 59 56 60 52 63Z", 0.3)}
    <path d="M66 54C58 44 58 30 66 22C74 30 74 44 66 54Z" fill="url(#rose)"/>
    <path d="M66 54C54 52 46 44 44 34C56 34 64 42 66 54Z" fill="url(#roseDeep)"/>
    <path d="M66 54C78 52 86 44 88 34C76 34 68 42 66 54Z" fill="url(#roseDeep)"/>
    <path d="M70 52C86 44 104 46 112 54C98 58 84 58 70 52Z" fill="url(#mint)"/>
    ${stroke("M24 40c4-6 0-10 4-16M106 28c-4-6 0-10-4-16", "url(#plum)", 3, 'stroke-opacity="0.7"')}`,

  body_contour: `${floor(64, 32)}
    <path d="M40 8C40 30 50 40 48 56C46 72 34 80 34 98C34 108 38 114 42 118H86C90 114 94 108 94 98C94 80 82 72 80 56C78 40 88 30 88 8Z" fill="url(#peach)"/>
    ${shine("M44 12C44 30 54 42 52 58C50 70 42 78 40 92C38 78 46 70 46 56C48 40 42 30 44 12Z", 0.4)}
    <path d="M30 54C50 62 78 62 98 54L100 66C78 74 50 74 28 66Z" fill="url(#gold)"/>
    ${[38, 48, 58, 68, 78, 88].map((x) => `<rect x="${x}" y="${x === 38 || x === 88 ? 60 : 62}" width="2" height="6" rx="1" fill="#9A5F0C"/>`).join("")}
    <path d="M98 54L114 50L112 62L100 66Z" fill="url(#goldDeep)"/>
    ${star(18, 28, 8)}${star(110, 24, 6, "url(#rose)")}`,

  tanning: `${floor(64, 30)}
    <circle cx="64" cy="56" r="44" fill="url(#glow)"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => rot(a, 64, 56, `<path d="M60 8H68L64 22Z" fill="url(#gold)"/>`)).join("")}
    <circle cx="64" cy="56" r="26" fill="url(#gold)"/>
    ${shine("M48 46C52 38 60 34 68 34C60 38 54 44 52 54Z", 0.7)}`,

  // ── general / fallback ─────────────────────────────────────────────────
  sparkles: `${floor(64, 30)}
    ${star(58, 64, 40)}
    ${star(98, 26, 16, "url(#rose)")}
    ${star(100, 92, 10, "url(#plum)")}
    ${shine("M50 46C54 54 54 58 58 62C52 58 50 54 50 46Z", 0.8)}`,

  consult: `${floor(64, 34)}
    <path d="M20 22H108C112 22 116 26 116 30V80C116 84 112 88 108 88H56L34 106V88H20C16 88 12 84 12 80V30C12 26 16 22 20 22Z" fill="url(#rose)"/>
    ${shine("M22 30H96C98 30 98 34 96 34H22C20 34 20 30 22 30Z", 0.55)}
    ${star(64, 55, 18, "#fff")}${dot(38, 55, 5, "#fff")}${dot(90, 55, 5, "#fff")}`,

  gift: `${floor(64, 40)}
    <rect x="22" y="56" width="84" height="56" rx="8" fill="url(#rose)"/>
    <rect x="16" y="40" width="96" height="22" rx="7" fill="url(#roseDeep)"/>
    <rect x="56" y="40" width="16" height="72" fill="url(#gold)"/>
    <path d="M64 40C52 22 30 22 34 34C36 40 50 42 64 40ZM64 40C76 22 98 22 94 34C92 40 78 42 64 40Z" fill="url(#gold)"/>
    ${shine("M28 64h6v42h-6z", 0.5)}`,

  vip: `${floor(64, 34)}
    <path d="M64 6L78 42L116 44L86 68L96 106L64 84L32 106L42 68L12 44L50 42Z" fill="url(#gold)"/>
    ${shine("M64 18L72 42L60 44Z", 0.7)}
    <path d="M64 30L72 50L94 52L76 66L82 88L64 76L46 88L52 66L34 52L56 50Z" fill="url(#rose)" opacity="0.9"/>`
};

// Older ids that are no longer offered in the picker but may still be stored
// on services and bookings -- they borrow the closest new drawing.
export const LUXE_ALIASES = {
  hair_styling: "blowdry",
  hair_extension: "highlights",
  hair_wash: "keratin",
  comb: "haircut",
  hair_botox: "keratin",
  hair_perm: "hair_straight",
  scalp_care: "keratin",
  hair_loss: "keratin",
  hair_transplant: "haircut",
  kids_haircut: "haircut",
  root_touch: "hair_color",
  barber: "haircut",
  beard: "haircut",
  razor: "haircut",
  men_cut: "haircut",
  groom: "crown",
  palette: "eyeshadow",
  makeup_lesson: "makeup_brush",
  party: "party_makeup",
  brow_tint: "eyebrow",
  lash_tint: "lash_ext",
  nail_spa: "manicure",
  acne: "facial",
  oxygen_facial: "hydrafacial",
  led_therapy: "face_mask",
  teeth: "sparkles",
  thread_lift: "hifu",
  doctor: "consult",
  aroma: "spa",
  perfume: "spa",
  sauna: "spa",
  body_scrub: "skincare",
  moroccan_bath: "spa",
  hijama: "massage",
  foot_massage: "pedicure",
  tattoo: "permanent_makeup",
  gem: "ring",
  henna: "nail_art",
  piercing: "ring",
  tattoo_machine: "permanent_makeup",
  yoga: "spa",
  pilates: "spa",
  fitness: "body_contour",
  meditation: "spa",
  nutrition: "body_contour",
  physio: "massage",
  counseling: "consult",
  rejuvenation: "serum",
  mirror: "party_makeup",
  heart: "lips",
  rose: "bouquet",
  photoshoot: "sparkles",
  training: "consult",
  home_service: "vip",
  discount: "gift",
  kids_care: "sparkles",
  express: "sparkles"
};
