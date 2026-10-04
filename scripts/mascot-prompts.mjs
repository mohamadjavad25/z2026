// Builds docs/mascot/prompts.md: one image-generation prompt per sheet of 6 service stickers,
// all anchored to the same reference mascot. Run: node scripts/mascot-prompts.mjs
import { writeFileSync } from "node:fs";
import { BEAUTY_EMOJIS } from "../app/shared/constants/beautyEmoji.js";

// id -> what the mascot is doing / holding (English, visual, one idea per sticker).
const SCENES = {
  haircut: "snipping a lock of its own curly hair with a pair of scissors, tiny hair clippings flying",
  hair_color: "holding a tint bowl and brush, a stripe of fresh orange dye on its curl",
  highlights: "with sun-kissed golden streaks in its curl, holding a foil strip",
  blowdry: "holding a hair dryer, curl bouncing in the warm air",
  updo: "with its hair piled in an elegant bun with a tiny pearl pin",
  hair_styling: "holding a curling iron, its curl turned into a perfect spiral",
  keratin: "with silky shiny straight hair, a small keratin bottle with sparkles",
  hair_extension: "proudly holding a long glossy braid-like hair extension",
  braid: "braiding its long hair into a neat plait with a little ribbon",
  hair_wash: "in a bubble bath cap with foam on its curl, a shampoo bottle beside it",
  comb: "gently combing its curl with a wide-tooth comb",
  hair_botox: "holding a small treatment jar with a sparkling smooth-hair swirl above it",
  hair_perm: "with tight bouncy perm curls and a few curlers in its hair",
  scalp_care: "getting a scalp massage, eyes closed, tiny relaxing sparkles",
  hair_loss: "looking at a small hair-growth serum dropper, hopeful face, a tiny sprout on its head",
  hair_transplant: "planting a tiny sprout on its head with tweezers, determined face",
  kids_haircut: "a tiny version sitting on a booster seat with a cape, getting a cute trim",
  root_touch: "pointing at the base of its curl with a small color brush",
  hair_straight: "holding a flat iron, its hair perfectly straight and shiny",
  barber: "wearing a barber cape next to a red-white barber pole, holding clippers",
  beard: "with a big fluffy beard it is brushing proudly",
  razor: "holding a straight razor with a shaving-foam beard, careful smile",
  men_cut: "with a sharp short fade haircut, holding a hand mirror",
  groom: "in a tiny bow tie and a neat tuxedo collar, groomed and confident",
  lipstick: "holding up a lipstick, lips shiny rose-pink",
  eyeshadow: "with colorful shimmering eyeshadow, holding a small eyeshadow brush",
  makeup_brush: "contouring its cheek with a big fluffy brush, a puff of powder",
  lips: "blowing a kiss, glossy rose lips, a tiny heart floating away",
  palette: "holding a makeup palette bigger than itself, delighted",
  eyeliner: "drawing a perfect winged liner with a thin pen, tongue slightly out in focus",
  makeup_lesson: "pointing at a tiny whiteboard with a face chart, wearing round glasses",
  party_makeup: "glamorous party look with glitter, sparkles and a party hat",
  bridal: "wearing a long veil and a small bouquet, tears of joy",
  crown: "wearing a small sparkling golden crown, regal and proud",
  bouquet: "holding a big bouquet of rose-pink flowers",
  ring: "holding up a shiny diamond ring with starry eyes",
  party: "throwing confetti, with a party popper and streamers",
  eyebrow: "with perfectly shaped brows, holding an eyebrow pencil",
  lash_ext: "with long fluttery lashes, holding tweezers with a single lash",
  lash_lift: "with lifted curled lashes and a tiny lash curler",
  brow_lamination: "with fluffy brushed-up brows, holding a spoolie brush",
  brow_tint: "holding a small tint dish and brush, dark fresh brows",
  threading: "pulling a thin thread between its teeth and fingers, focused",
  lash_tint: "with dark tinted lashes and a tiny tint brush",
  manicure: "showing off freshly painted nails on a raised hand",
  pedicure: "foot soaking in a tub, toes painted, relaxed face",
  nail_art: "with tiny decorated nails with stars and hearts, holding a dotting tool",
  gel_nails: "with glossy gel nails under a small UV lamp",
  nail_polish: "holding a big nail polish bottle and brush, proud",
  french_nails: "showing classic French-tip nails on a raised hand",
  nail_spa: "hands soaking in a bowl of warm water with flower petals",
  facial: "lying back with cucumber slices on its eyes, glowing cheeks",
  skincare: "patting moisturizer on its cheeks, a small cream jar nearby",
  serum: "holding a glass dropper bottle, one glowing drop falling",
  hydrafacial: "with a hydration device and water droplets around its glowing face",
  peeling: "with a soft peeling mask partly lifted, fresh skin underneath",
  microneedling: "holding a tiny derma roller, brave smile, sparkles on its cheek",
  face_mask: "wearing a sheet face mask with eye and mouth holes, relaxed",
  acne: "holding a small spot-treatment tube, a pimple patch on its cheek",
  oxygen_facial: "with an oxygen mist spraying on its face, bubbles around",
  led_therapy: "wearing a glowing LED light mask, soft pink and blue glow",
  injection: "holding a small syringe, calm professional smile, tiny sparkle",
  laser: "with a small laser wand emitting a thin beam, safety goggles",
  teeth: "showing off a bright sparkling smile and a toothbrush",
  filler: "plump cheeks and a small syringe, a tiny sparkle on its lips",
  prp: "holding a small test tube of golden liquid, sparkles",
  hifu: "a skin-tightening device with wave lines near its cheek, lifted face",
  thread_lift: "holding a fine thread needle near a lifted cheekline, sparkle",
  doctor: "wearing a doctor's coat and head mirror, holding a clipboard",
  waxing: "holding a wax spatula with a warm wax jar, nervous-but-brave face",
  massage: "lying on a table getting a back massage, blissful face",
  spa: "in a bathrobe with a towel turban, relaxing near candles",
  aroma: "smelling a small aroma diffuser with swirling scent, eyes closed",
  tanning: "wearing sunglasses on a sunbed, golden tan, a little sun",
  body_contour: "measuring its tummy with a tape measure, confident smile",
  perfume: "spritzing a perfume bottle, a cloud of tiny hearts",
  sauna: "in a towel inside a wooden sauna with steam clouds",
  body_scrub: "scrubbing its arm with a sugar scrub, foamy bubbles",
  moroccan_bath: "in a steamy bath with a scrub mitt, warm tiles behind",
  hijama: "with small cupping glasses on its back, calm focused face",
  stone_massage: "with smooth warm stones stacked on its back, relaxed",
  foot_massage: "holding up a foot being massaged, ticklish smile",
  tattoo: "showing a small heart tattoo on its arm, proud",
  gem: "holding a big sparkling gem, wide eyes",
  henna: "with intricate henna patterns on its hand",
  piercing: "with a tiny earring and a piercing needle nearby, brave face",
  tattoo_machine: "holding a tattoo machine with a tiny ink drop",
  permanent_makeup: "with perfect microbladed brows and a tiny pigment pen",
  yoga: "in a calm tree-pose on a yoga mat, eyes closed",
  pilates: "stretching on a pilates ball, balanced and smiling",
  fitness: "lifting a small dumbbell, tiny sweat drop, determined",
  meditation: "sitting cross-legged meditating with a floating glow",
  nutrition: "holding a bowl of fresh fruit and a green leaf",
  physio: "stretching its arm with a resistance band, supportive coach face",
  counseling: "sitting in an armchair listening kindly, holding a notebook",
  rejuvenation: "radiant youthful glow with a little sparkle trail, refreshed",
  mirror: "admiring itself in a hand mirror, happy",
  consult: "talking with a speech bubble containing a heart, holding a notepad",
  gift: "holding a wrapped gift box with a ribbon, surprised joy",
  vip: "wearing a VIP star badge and sunglasses, cool pose",
  sparkles: "surrounded by big and small sparkles, wide-eyed wonder",
  heart: "hugging a big pink heart",
  rose: "holding a single rose, shy blush",
  photoshoot: "posing with a camera flash and a tiny reflector, fashionable",
  training: "holding a pointer and standing by a small blackboard, teacher glasses",
  home_service: "carrying a rolling beauty kit, a tiny house behind it, friendly wave",
  discount: "holding a big percent-off tag with a happy face",
  kids_care: "a tiny child-sized version with a balloon and a toy",
  express: "running fast with speed lines and a stopwatch, determined"
};

const missing = BEAUTY_EMOJIS.filter((e) => !SCENES[e.id]).map((e) => e.id);
if (missing.length) throw new Error(`no scene for: ${missing.join(", ")}`);

const MASTER = `Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.`;
const STYLE = `Flat vector sticker style, clean dark outline of uniform weight (same weight in every sticker), soft cel-shading. Pure white background (#FFFFFF), generous space between the stickers, each sticker fully separate and not touching or overlapping anything, no text, no border, no frame, no ground shadow. No purple or violet. Very high resolution, at least 3000px wide.`;

const items = BEAUTY_EMOJIS;
const sheets = [];
for (let i = 0; i < items.length; i += 6) sheets.push(items.slice(i, i + 6));

let md = `# Mascot sticker prompts\n\nGenerated by \`node scripts/mascot-prompts.mjs\` from the live icon list (${items.length} icons, ${sheets.length} sheets).\n\n`;
md += `**How to use**\n1. Open a chat with the image model that made the approved sample, attach the reference mascot image, paste one sheet prompt below.\n2. Download the sheet PNG as-is (no re-compression), name it \`sheet-01.png\` ... and put it in \`mascot/sheets/\`.\n3. Run \`node scripts/slice-sticker-sheet.mjs mascot/sheets/sheet-01.png --ids <the ids line under the prompt>\`.\n\nKeep the same order left-to-right, top-to-bottom as written. If the model reorders or merges items, regenerate that sheet.\n\n`;
sheets.forEach((sheet, idx) => {
  const n = String(idx + 1).padStart(2, "0");
  const list = sheet.map((e, k) => `${k + 1}) ${SCENES[e.id]}`).join("\n");
  md += `## Sheet ${n} — ${[...new Set(sheet.map((e) => e.fa))].join("، ")}\n\n`;
  md += "```\n" + `${MASTER}\n\nA grid of ${sheet.length} sticker illustrations, 3 per row in 2 rows, left to right then top to bottom, each the same size. Each shows the mascot (full body or half body, whichever fits) ${"doing the following"}:\n${list}\n\n${STYLE}\n` + "```\n\n";
  md += `ids: \`${sheet.map((e) => e.id).join(",")}\`\n\n`;
});
writeFileSync(new URL("../docs/mascot/prompts.md", import.meta.url), md);
console.log(`wrote docs/mascot/prompts.md (${sheets.length} sheets)`);
