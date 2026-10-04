// Nail icons -- 128x128 canvas, one warm ink outline, flat fills with one shade + one shine.
// Shapes are drawn twice (a thick ink layer, then the fill on top) so overlapping parts share a
// single clean outline instead of showing seams.

const INK = "#33262E";
const SKIN = "#FFD8C2";
const SKIN_SHADE = "#F4B99C";
const PINK = "#FF4F86";
const PINK_SHINE = "#FFC2D6";

const solid = (shapes, fill, width = 7) =>
  shapes.map((s) => `<g fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round">${s}</g>`).join("")
  + shapes.map((s) => `<g fill="${fill}">${s}</g>`).join("");

const line = (d, color = INK, width = 3.2) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

const spark = (x, y, r, fill = "#FFD966") =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${fill}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;

const nailOn = (x, y, w, h, extra = "") =>
  `<g ${extra}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${PINK}" stroke="${INK}" stroke-width="2.6"/><rect x="${x + w * 0.22}" y="${y + h * 0.14}" width="${w * 0.2}" height="${h * 0.42}" rx="${w * 0.1}" fill="${PINK_SHINE}"/></g>`;

// the smooth nail plate used by the single-nail icons
const NAIL = "M34 50 Q34 14 64 14 Q94 14 94 50 V92 Q94 108 78 108 H50 Q34 108 34 92Z";

export default {
  // مانیکور: a hand with freshly painted nails
  manicure:
    solid([
      '<rect x="36" y="30" width="13" height="50" rx="6.5"/>',
      '<rect x="51" y="20" width="13" height="58" rx="6.5"/>',
      '<rect x="66" y="26" width="13" height="52" rx="6.5"/>',
      '<rect x="81" y="38" width="13" height="42" rx="6.5"/>',
      '<path d="M34 70 H96 V96 Q96 116 76 116 H54 Q34 116 34 94Z"/>',
      '<rect x="14" y="64" width="15" height="42" rx="7.5" transform="rotate(-32 21.5 85)"/>'
    ], SKIN)
    + `<path d="M36 100 Q56 108 94 98 V104 Q92 116 76 116 H54 Q36 116 36 100Z" fill="${SKIN_SHADE}"/>`
    + nailOn(37.5, 32, 10, 15) + nailOn(52.5, 22, 10, 15) + nailOn(67.5, 28, 10, 15) + nailOn(82.5, 40, 10, 14)
    + nailOn(16, 59, 10, 14, 'transform="rotate(-32 21 66)"')
    + line("M46 62 V76 M61 60 V76 M76 62 V76", SKIN_SHADE, 2.4)
    + spark(108, 30, 9) + spark(18, 28, 6, "#7FE0C4") + spark(110, 74, 5, "#FF8FB5"),

  // پدیکور: a painted foot with a daisy
  pedicure:
    solid([
      '<path d="M32 62 Q30 50 44 49 L86 51 Q102 56 99 78 Q97 102 86 113 Q72 124 56 119 Q40 113 38 94 Q36 76 32 62Z"/>',
      '<circle cx="36" cy="38" r="11"/>', '<circle cx="54" cy="29" r="9"/>', '<circle cx="70" cy="27" r="8.5"/>',
      '<circle cx="85" cy="31" r="8"/>', '<circle cx="97" cy="41" r="7"/>'
    ], SKIN)
    + `<path d="M40 98 Q44 115 58 119 Q74 123 86 113 Q71 113 61 102 Q53 94 40 98Z" fill="${SKIN_SHADE}"/>`
    + [[36, 37, 6.4], [54, 28, 5.4], [70, 26, 5.1], [85, 30, 4.8], [97, 40, 4.2]].map(([x, y, r]) =>
        `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.95}" fill="${PINK}" stroke="${INK}" stroke-width="2.4"/><ellipse cx="${x - r * 0.3}" cy="${y - r * 0.35}" rx="${r * 0.28}" ry="${r * 0.4}" fill="${PINK_SHINE}"/>`).join("")
    + `<g transform="translate(100 100)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-9" rx="5.2" ry="8" fill="#fff" stroke="${INK}" stroke-width="2.4" transform="rotate(${a})"/>`).join("")}<circle r="5" fill="#FFD966" stroke="${INK}" stroke-width="2.4"/></g>`
    + spark(16, 92, 7, "#7FE0C4") + spark(20, 16, 5),

  // طراحی ناخن: one big nail with art + a fine brush
  nail_art:
    `<path d="${NAIL}" fill="${INK}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`
    + `<path d="${NAIL}" fill="#FF8FB5"/>`
    + `<clipPath id="na"><path d="${NAIL}"/></clipPath><g clip-path="url(#na)"><path d="M30 78 Q64 66 98 78 V112 H30Z" fill="#FF6B9C"/><path d="M34 40 Q64 56 94 40" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/></g>`
    + `<path d="M64 74 C50 62 46 52 52 46 C57 41 62 45 64 49 C66 45 71 41 76 46 C82 52 78 62 64 74Z" fill="#fff" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<circle cx="46" cy="90" r="3.6" fill="#FFD966"/><circle cx="58" cy="94" r="3" fill="#7FE0C4"/><circle cx="80" cy="92" r="3.6" fill="#8EC9FF"/><circle cx="90" cy="82" r="2.6" fill="#fff"/>`
    + `<rect x="42" y="24" width="7" height="22" rx="3.5" fill="#fff" opacity=".6"/>`
    + `<g transform="rotate(38 100 96)"><rect x="95" y="62" width="10" height="42" rx="5" fill="#FFD966" stroke="${INK}" stroke-width="3"/><rect x="94" y="100" width="12" height="9" rx="2" fill="#C8CEDA" stroke="${INK}" stroke-width="3"/><path d="M95 109 Q100 126 105 109Z" fill="${PINK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>`
    + spark(18, 30, 8) + spark(112, 22, 6, "#7FE0C4"),

  // کاشت و ژلیش: UV nail lamp with a glossy nail under the light
  gel_nails:
    solid(['<path d="M16 98 Q16 38 64 38 Q112 38 112 98 V106 Q112 114 104 114 H24 Q16 114 16 106Z"/>'], "#BFEBDC")
    + `<path d="M16 98 Q16 40 64 38 Q36 52 36 98 V114 H24 Q16 114 16 106Z" fill="#fff" opacity=".45"/>`
    + `<path d="M32 114 V92 Q32 62 64 62 Q96 62 96 92 V114Z" fill="${INK}"/>`
    + `<path d="M40 114 V94 Q40 70 64 70 Q88 70 88 94 V114Z" fill="#FFE29A"/>`
    + `<path d="M48 114 V96 Q48 80 64 80 Q80 80 80 96 V114Z" fill="#FFF6D6"/>`
    + `<rect x="54" y="84" width="20" height="32" rx="10" fill="${SKIN}" stroke="${INK}" stroke-width="2.8"/><rect x="57" y="87" width="14" height="17" rx="7" fill="${PINK}" stroke="${INK}" stroke-width="2.4"/><rect x="60" y="89" width="3.2" height="8" rx="1.6" fill="${PINK_SHINE}"/>`
    + `<circle cx="38" cy="52" r="4" fill="#FFD966" stroke="${INK}" stroke-width="2.4"/><circle cx="64" cy="46" r="4" fill="#FFD966" stroke="${INK}" stroke-width="2.4"/><circle cx="90" cy="52" r="4" fill="#FFD966" stroke="${INK}" stroke-width="2.4"/>`
    + line("M64 20 V30 M42 26 L48 33 M86 26 L80 33", "#FFB400", 4)
    + spark(112, 24, 8) + spark(14, 30, 6, "#FF8FB5"),

  // لاک و لاک‌ژل: a polish bottle
  nail_polish:
    solid(['<rect x="50" y="8" width="28" height="40" rx="9"/>'], "#4A3943")
    + `<rect x="55" y="13" width="5" height="28" rx="2.5" fill="#fff" opacity=".28"/>`
    + solid(['<rect x="54" y="44" width="20" height="16" rx="3"/>'], "#C8CEDA")
    + solid(['<rect x="28" y="56" width="72" height="58" rx="20"/>'], "#FFE6EF")
    + `<clipPath id="np"><rect x="28" y="56" width="72" height="58" rx="20"/></clipPath><g clip-path="url(#np)"><path d="M24 74 Q46 68 64 74 T104 74 V120 H24Z" fill="${PINK}"/><path d="M24 74 Q46 68 64 74 T104 74" fill="none" stroke="#fff" stroke-width="2.4" opacity=".6"/></g>`
    + `<rect x="35" y="66" width="7" height="34" rx="3.5" fill="#fff" opacity=".7"/>`
    + `<path d="M72 98 C62 90 60 84 66 81 C70 79 72 82 73 84 C74 82 77 79 81 81 C87 84 85 90 72 98Z" fill="#fff"/>`
    + `<path d="M108 82 C102 92 100 98 108 100 C116 98 114 92 108 82Z" fill="${PINK}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`
    + spark(14, 36, 8) + spark(112, 40, 5, "#7FE0C4"),

  // فرنچ: a nail with the white tip
  french_nails:
    solid(['<path d="M34 124 V50 Q34 14 64 14 Q94 14 94 50 V124Z"/>'], SKIN)
    + `<path d="M34 100 V124 H94 V100 Q64 112 34 100Z" fill="${SKIN_SHADE}"/>`
    + `<path d="M44 58 Q44 24 64 24 Q84 24 84 58 V70 Q84 78 76 78 H52 Q44 78 44 70Z" fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
    + `<clipPath id="fn"><path d="M44 58 Q44 24 64 24 Q84 24 84 58 V70 Q84 78 76 78 H52 Q44 78 44 70Z"/></clipPath><g clip-path="url(#fn)"><rect x="40" y="20" width="48" height="60" fill="#FFC4B4"/><path d="M40 14 H88 V50 Q64 66 40 50Z" fill="#fff"/><path d="M44 50 Q64 66 84 50" fill="none" stroke="#F29C86" stroke-width="2.4" opacity=".9"/></g>`
    + `<rect x="50" y="56" width="5.5" height="16" rx="2.7" fill="#fff" opacity=".7"/>`
    + `<path d="M48 82 Q64 90 80 82" fill="none" stroke="${SKIN_SHADE}" stroke-width="3" stroke-linecap="round"/>`
    + line("M52 100 V112 M64 102 V114 M76 100 V112", SKIN_SHADE, 2.4)
    + spark(106, 30, 9) + spark(20, 52, 6, "#FF8FB5") + spark(108, 84, 5, "#7FE0C4"),

  // پارافین و اسپا: a hand dipped in a warm wax bowl
  nail_spa:
    solid(['<rect x="40" y="28" width="48" height="56" rx="22"/>', '<rect x="30" y="52" width="16" height="30" rx="8" transform="rotate(24 38 67)"/>'], SKIN)
    + nailOn(46, 32, 9, 12) + nailOn(60, 28, 9, 12) + nailOn(74, 32, 9, 12)
    + `<path d="M12 70 H116 Q116 118 64 118 Q12 118 12 70Z" fill="${INK}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`
    + `<path d="M12 70 H116 Q116 118 64 118 Q12 118 12 70Z" fill="#8EC9FF"/>`
    + `<path d="M16 88 Q64 104 112 88 Q108 118 64 118 Q22 118 16 88Z" fill="#6BB3F2"/>`
    + `<ellipse cx="64" cy="70" rx="52" ry="12" fill="${INK}"/><ellipse cx="64" cy="70" rx="46" ry="9" fill="#FFF3E6"/>`
    + `<path d="M40 78 Q64 84 88 78" fill="none" stroke="#fff" stroke-width="2.6" opacity=".9" stroke-linecap="round"/>`
    + `<g transform="translate(64 96)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-5" rx="3.4" ry="5" fill="#fff" transform="rotate(${a})"/>`).join("")}<circle r="3" fill="#FFD966"/></g>`
    + `<circle cx="22" cy="46" r="5" fill="#E8F6FF" stroke="${INK}" stroke-width="2.4"/><circle cx="108" cy="36" r="7" fill="#E8F6FF" stroke="${INK}" stroke-width="2.4"/><circle cx="104" cy="54" r="3.6" fill="#E8F6FF" stroke="${INK}" stroke-width="2.2"/>`
    + `<path d="M20 22 q6-8 0-16 M30 24 q6-8 0-16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".0"/>`
    + spark(100, 14, 7) + spark(14, 24, 6, "#FF8FB5")
};
