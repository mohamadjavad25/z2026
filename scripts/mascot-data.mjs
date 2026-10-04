// Single source for the mascot sticker brief. Edit here, then run: node scripts/mascot-prompts.mjs
// Each scene = what the mascot does + the props (with colours) + the small accents. Keep ids stable.

// ---- Part A: one sticker per service in the icon pack (ids are stored in the database) ----
export const SERVICE_SCENES = {
  hair: {
    title: "مو",
    palette: "copper/tangerine tones, teal and aqua tools, a few white highlights",
    items: [
      ["haircut", "کوتاهی مو", "Half-body, proud little grin. It holds a pair of big silver scissors with red-coral handles in one hand and snips a single lock of its own orange curl, which falls in a small arc. Three tiny orange hair clippings and one yellow sparkle float around the scissors."],
      ["hair_color", "رنگ مو", "Half-body, concentrated happy face with the tongue tip slightly out. One hand holds a round teal tint bowl full of glossy orange dye, the other a wide flat tint brush loaded with dye; a fresh orange-to-pink stripe is painted on one of its curls. A couple of dye drops fall into the bowl."],
      ["highlights", "لایت و هایلایت", "Half-body, confident wink. Its curl has bright golden-blonde streaks that glow; one hand holds a silver foil strip wrapped around a streak, the other a small tint brush. Three yellow sparkles shine on the streaks."],
      ["blowdry", "براشینگ و سشوار", "Half-body, eyes squeezed happily shut, mouth open in a laugh. It holds a coral-red hair dryer with a dark-ink nozzle; a warm wind of three light-blue curved air lines makes its curls and heart-curl bounce sideways. A round brush sticks out of its apron pocket."],
      ["updo", "شینیون و مدل مو", "Half-body, elegant calm smile, chin slightly raised. Its curls are gathered into a neat high bun with a gold hair pin topped by a small pearl; a couple of curled strands fall by its cheeks. It holds up a second pearl pin between two fingers. Gold sparkles around the bun."],
      ["hair_styling", "حالت‌دهی و فر", "Half-body, playful open smile. It holds a hot-pink curling iron, a long ringlet of orange hair wound round it; a perfect spiral curl bounces down. Small steam puffs and sparkles rise from the iron."],
      ["keratin", "کراتین و احیا", "Half-body, blissful closed eyes. Its hair is super smooth, long and silky with big white shine streaks. It holds a small amber treatment bottle with a gold cap, a sparkling droplet above it and a tiny shield-with-a-heart badge on the bottle."],
      ["hair_extension", "اکستنشن مو", "Half-body, surprised-delighted wide eyes. Both hands proudly hold a long glossy orange hair extension piece stretched like a ribbon, with a small clip at the top; the piece shines with a white highlight. Sparkles around."],
      ["braid", "بافت مو", "Half-body, focused cheerful smile. Its orange hair falls in a long thick braid over one shoulder, tied with a rose-pink ribbon bow; its hand is finishing the last cross of the braid. Two tiny flowers tucked in the braid."],
      ["hair_wash", "شستشو و ماسک مو", "Half-body in a fluffy white bubble-foam hat made of soap bubbles on its head, eyes closed in joy. It holds a mint-green shampoo bottle with a drop on the bottle; many round soap bubbles with white glints float around."],
      ["comb", "برس و شانه", "Half-body, gentle happy smile, one eye winking. It combs one long orange lock with a big wide-tooth tortoise-shell comb; a smooth shine streak runs along the lock. A wooden paddle brush rests in its other hand."],
      ["hair_botox", "بوتاکس مو", "Half-body, relaxed smile. It holds a small glass jar of creamy pearl-white treatment with a gold lid and a little spatula; above the jar a soft sparkling swirl rises and wraps into a shiny wave of hair."],
      ["hair_perm", "فر دائم", "Half-body, wide excited eyes. Its hair is full of tight springy ringlets and three pink hair curlers are still rolled in at the top; it bounces a ringlet with one finger like a spring (boing lines). Sparkles."],
      ["scalp_care", "مراقبت پوست سر", "Half-body, blissful closed eyes, big happy smile. Two small hands (not its own — floating cream-coloured hands with ink outline) massage its head; tiny calm sparkles and little leaf shapes around, mint-green scalp-serum dropper in front."],
      ["hair_loss", "درمان ریزش مو", "Half-body, hopeful small smile. It holds a dropper bottle of green hair-growth serum; one bald-looking spot on its head now shows a tiny green sprout with two leaves. A small upward arrow made of sparkles."],
      ["hair_transplant", "کاشت مو", "Half-body, brave determined face. It holds fine tweezers carefully planting a tiny orange hair strand; a small neat row of new strands is already planted, each with a tiny sparkle. A mini dotted-line planting grid hovers on its head."],
      ["kids_haircut", "کوتاهی کودک", "A smaller baby-sized version of the mascot (bigger head, shorter curl) sitting on a booster seat with a yellow cape tied at the neck, giggling; a tiny comb in one hand, a lollipop in the other. Tiny clipped curl pieces fall; a balloon floats behind."],
      ["root_touch", "رنگ ریشه", "Half-body, careful concentrated face. It parts its hair with one hand showing a visible root line and with the other applies orange dye with a thin brush exactly at the base; a small tint dish with a brush rests on its shoulder. A neat, thin glow line at the roots."],
      ["hair_straight", "صافی مو", "Half-body, satisfied smug smile. It holds a rose-gold flat iron; the half of its hair above is perfectly poker-straight and glossy, the part below still curly — proud before/after look. Shine lines and sparkles."]
    ]
  },
  men: {
    title: "آقایان",
    palette: "navy, cream, red and white barber stripes, steel grey",
    items: [
      ["barber", "آرایشگر مردانه", "Half-body, cool proud smile. It wears a striped red-white-navy barber cape collar and stands in front of a red-white-blue barber pole; one hand holds electric clippers, the other a comb. Tiny clipped hair bits and a sparkle."],
      ["beard", "ریش", "Half-body, proud smile. It sports a big fluffy brown-copper beard shaped neatly with sharp edges, brushing it with a small beard brush; a tiny bottle of beard oil in its apron pocket. Two sparkles on the beard."],
      ["razor", "اصلاح با تیغ", "Half-body, careful calm face. Its chin and cheeks are covered in white shaving-foam beard; it holds a classic straight razor with a wooden handle, one clean stripe already shaved through the foam. Little foam bubbles float."],
      ["men_cut", "کوتاهی مردانه", "Half-body, confident wink. Its orange curls are trimmed into a clean sharp fade with a short quiff and the heart curl still on top; it holds a hand mirror showing the back of its fresh cut. Fresh-cut sparkles."],
      ["groom", "داماد", "Half-body, bashful happy face with blushing cheeks. It wears a navy tuxedo jacket over its apron, a white shirt, a red bow tie and a small white boutonniere flower; hair slicked neat. A tiny gold ring box in one hand."]
    ]
  },
  makeup: {
    title: "آرایش",
    palette: "rose-pink, coral, gold, soft peach",
    items: [
      ["lipstick", "آرایش (لیپ‌استیک)", "Half-body, flirty wink. It holds up a big open rose-pink lipstick with a gold case; its own lips show a glossy rose smile. A kiss-mark and a sparkle near the lipstick."],
      ["eyeshadow", "سایه چشم", "Half-body, one eye closed to show a glowing rose-gold shimmer eyeshadow with a tiny glitter fleck, the other eye open and sparkling. It holds a small eyeshadow brush and a mini round compact."],
      ["makeup_brush", "کانتور و براش", "Half-body, happy dreamy face. It sweeps a huge fluffy blush brush across its cheek leaving a pink powder cloud with sparkles; the brush has a rose-gold handle. A tiny contour stick in the apron pocket."],
      ["lips", "لب", "Close-up style bust, eyes sparkling, blowing a kiss: glossy rose-pink lips and a small heart floating away with a motion trail; a lip-gloss wand in the other hand with a shiny droplet."],
      ["palette", "پالت آرایشی", "Half-body, delighted wide-open eyes and open smile. It hugs a huge open makeup palette with 6 colourful pans (rose, peach, gold, mint, sky-blue, coral) and a tiny mirror in the lid; a mini brush in the other hand. Sparkles."],
      ["eyeliner", "خط چشم", "Half-body, concentrated look with the tongue slightly out. It draws a perfect winged black eyeliner on its own eye with a thin pen held in a steady hand; a tiny dotted guide line and a sparkle at the wing tip."],
      ["makeup_lesson", "آموزش آرایش", "Half-body, teacher pose with small round glasses. It points a stick at a small whiteboard showing a simple face chart with arrows and a heart; a makeup brush behind the ear, a tiny graduation cap on the heart-curl."],
      ["party_makeup", "آرایش مجلسی", "Half-body, starry-eyed glamorous look with gold glitter eyelids, long lashes and deep rose lips; a small sparkling tiara pin, a mini disco-ball and confetti around; a champagne-pink tone."]
    ]
  },
  bridal: {
    title: "عروس و مراسم",
    palette: "white, blush pink, gold, soft green leaves",
    items: [
      ["bridal", "عروس", "Half-body, teary happy eyes, hands clasped under the chin. It wears a long sheer white veil with a lace edge fixed by a small flower crown, a pink apron changed to a white bodice, and holds a small bouquet. Floating hearts and sparkles."],
      ["crown", "تاج", "Half-body, regal proud smile, chin up. A sparkling gold crown with three round rubies and tiny pearls sits between its curls and the heart-curl; it holds a small royal sceptre with a star. Gold sparkles."],
      ["bouquet", "دسته گل", "Half-body, shy happy face with blushing cheeks. It holds a big round bouquet of pink roses, white peonies and green leaves tied with a satin ribbon bow; a few petals fall."],
      ["ring", "حلقه", "Half-body, starry eyes, mouth open in awe. It holds up a shiny gold ring with a big sparkling blue-white diamond between two fingers; a big four-point shine flares on the diamond and tiny hearts float."],
      ["party", "جشن و مراسم", "Half-body, laughing mouth wide open, eyes closed in joy. It wears a striped party hat on the heart-curl, pops a party popper with confetti, and a small string of triangle flags hangs behind. Colourful confetti in rose, gold, mint, sky."]
    ]
  },
  brow_lash: {
    title: "ابرو و مژه",
    palette: "dark espresso, rose gold, soft grey",
    items: [
      ["eyebrow", "ابرو", "Half-body, calm confident smile. Its eyebrows are perfectly shaped thick arches (drawn clearly); it holds a brow pencil in one hand and a spoolie brush in the other. A tiny shine mark above the brow."],
      ["lash_ext", "اکستنشن مژه", "Half-body, dreamy eyes with very long fluttery curled lashes (clearly bigger lashes). It holds fine tweezers with one single lash; a mini lash tile with lashes rests on its apron. Sparkles at the lash tips."],
      ["lash_lift", "لیفت مژه", "Half-body, one eye wide to show lifted curled lashes, the other with a small silver lash curler clamped on. A tiny upward curve arrow and sparkles show the lift."],
      ["brow_lamination", "لمینت ابرو", "Half-body, smug smile. Its eyebrows are fluffy and brushed upward in a neat laminated style with a glossy shine; it brushes one up with a spoolie while holding a tiny glossy-gel tube."],
      ["brow_tint", "رنگ ابرو", "Half-body, focused face. It holds a tiny glass dish with dark brown dye and a thin brush, painting one brow darker — one brow done and rich brown, the other still light. A drop of dye sparkles."],
      ["threading", "نخ‌کشی صورت", "Half-body, brave concentrated face. It holds a thin white thread stretched between both hands and the teeth, twisted in the middle in the typical threading X shape; tiny hair bits fly away; a sparkle on the cleanly shaped brow."],
      ["lash_tint", "رنگ مژه", "Half-body, calm closed eye showing thick dark tinted lashes with a tiny brush beside it, and a miniature tint dish with a black dye. Small sparkles on the lashes."]
    ]
  },
  nails: {
    title: "ناخن",
    palette: "hot-pink, nude, red, glitter silver, soft white",
    items: [
      ["manicure", "مانیکور", "Half-body, big happy grin, one hand raised flat to the viewer showing perfectly painted rose-red nails with white shine marks; a tiny nail file in the other hand. Sparkles around the fingertips."],
      ["pedicure", "پدیکور", "Half-body, relaxed happy face. One foot rests on a small stool with toe separators and freshly painted coral toenails, a little footbath with petals and bubbles beside it, a towel on the shoulder. Sparkles on the toes."],
      ["nail_art", "نیل‌آرت", "Half-body, excited wide eyes. The nails show tiny art: a heart, a star, polka dots and a gem on different fingers; it holds a thin dotting tool and a tiny rhinestone. Glitter sparkles."],
      ["gel_nails", "ناخن ژله‌ای", "Half-body, relaxed smile. Its hand sits under a small pink UV nail lamp (pink body) that glows with soft light; the gel nails shine like glass with a big white glint."],
      ["nail_polish", "لاک", "Half-body, proud grin. It holds a big nail-polish bottle (hot-pink, black cap) with a brush dripping one shiny drop, and shows a single freshly painted nail with a glossy line. Sparkles."],
      ["french_nails", "فرنچ", "Half-body, elegant smile. One raised hand shows classic French-tip nails (nude base with crisp white tips) in clear detail; a small bottle of white tip polish is in the apron pocket. White glints."],
      ["nail_spa", "اسپای دست", "Half-body, blissful closed eyes. Both hands soak in a small round bowl of milky water with pink flower petals and bubbles; steam curls above; a mini towel on its shoulder."]
    ]
  },
  skin: {
    title: "پوست",
    palette: "mint green, aqua, white, soft peach",
    items: [
      ["facial", "فیشیال", "Half-body, relaxed with eyes closed and happy smile. Two round cucumber slices rest over its eyes, a pale-green clay mask covers its cheeks, a white headband holds the curls. Water drops and leaves sparkle."],
      ["skincare", "مراقبت پوست", "Half-body, glowing happy face with shiny cheeks. It pats a pearl-white cream onto its cheek with fingers, holding a small round cream jar with a gold lid; a lifted shine arc on the cheek. Sparkles."],
      ["serum", "سرم پوست", "Half-body, delighted look at the dropper. It holds a glass serum bottle with a gold dropper cap, a glowing yellow drop falling toward its cheek; a shiny crystal-clear droplet icon above."],
      ["hydrafacial", "هیدرافیشیال", "Half-body, refreshed happy face. A small white-and-aqua hydra-wand device with a spiral tip glides near its cheek, with water swirl lines and bubbles; skin glows with a shine arc."],
      ["peeling", "پیلینگ", "Half-body, funny surprised-but-ok face. A thin translucent peeling mask is being lifted from one cheek by two fingers, revealing smooth glowing skin under it; tiny flakes float. Sparkles on the clear cheek."],
      ["microneedling", "میکرونیدلینگ", "Half-body, brave smile with small sweat drop. It holds a small silver derma-roller pen with fine needles pointing to its cheek; a tiny sparkling dot trail on the skin and a shine."],
      ["face_mask", "ماسک صورت", "Half-body wearing a white sheet face mask with eye and mouth holes, only its big shiny eyes and little mouth visible; calm bliss. A little bowl of mint-green gel and leaves."],
      ["acne", "درمان جوش", "Half-body, hopeful smile. A round pimple patch with a sparkling star sits on its cheek; it holds a small tube of blue spot treatment. Small clean-skin sparkles in a ring."],
      ["oxygen_facial", "اکسیژن فیشیال", "Half-body, eyes closed refreshed face. A light-blue oxygen spray mist falls on its face from a small nozzle; many round oxygen bubbles with the O2 shape rise around."],
      ["led_therapy", "لایت‌تراپی (LED)", "Half-body wearing a glowing LED face mask with soft pink and blue light panels; relaxed smile in the eye holes; light rays and sparkles radiate softly."]
    ]
  },
  clinic: {
    title: "کلینیک",
    palette: "sky blue, white, teal, a touch of rose",
    items: [
      ["injection", "تزریق", "Half-body, calm professional smile. It wears a tiny white nurse cap on the heart-curl and holds a clear syringe with a pink liquid, one drop at the needle tip; a small plus-heart sparkle."],
      ["laser", "لیزر", "Half-body with clear safety goggles, focused face. It holds a sleek white-and-blue laser device with a thin beam of teal light and star sparkles at the tip; a small shield icon glow."],
      ["teeth", "دندان", "Half-body, huge bright grin showing neat white teeth with a star shine on one tooth; it holds a pink toothbrush with minty paste; a tiny tooth with a sparkle icon near."],
      ["filler", "فیلر", "Half-body, soft smile. A small clear syringe with a gel drop is held near its plump cheek; the cheek and lips look gently plump with a shine; sparkles. Tiny pink heart."],
      ["prp", "پی‌آر‌پی", "Half-body, calm smile. It holds a test tube of golden-yellow plasma beside a second one of red; a tiny centrifuge icon shape behind; sparkling droplets."],
      ["hifu", "هایفو", "Half-body, upbeat face with a visibly lifted cheek line. A white ultrasound probe with a blue tip sends three concentric wave arcs toward the cheek; small up-arrows of sparkles."],
      ["thread_lift", "لیفت با نخ", "Half-body, brave smile. Very thin golden threads curve along the cheek line lifting it, a fine needle in a hand; two sparkles at the lifted jaw."],
      ["doctor", "ویزیت پزشک", "Half-body, friendly confident smile. It wears a white doctor coat with a stethoscope and a round head mirror, holds a clipboard with a heart-rate line; a small first-aid cross badge."]
    ]
  },
  body: {
    title: "بدن و اسپا",
    palette: "sage green, teal, sand, warm cream, aqua",
    items: [
      ["waxing", "اپیلاسیون و واکس", "Half-body, brave-but-nervous wavy smile with one tiny sweat drop. It holds a wooden wax spatula with golden warm wax and a small wax pot with steam; a strip of cloth in the other hand."],
      ["massage", "ماساژ", "Half-body, blissful closed eyes lying face-down on a spa table with a white towel, a sage-green towel roll under its chin; two floating cream hands massage its back; small calm sparkles and a flower."],
      ["spa", "اسپا", "Half-body, relaxed smile, wearing a fluffy white bathrobe with a towel turban on its hair, next to a lit candle, stacked smooth stones and a green leaf; warm steam swirls."],
      ["aroma", "آروماتراپی", "Half-body, eyes closed, deep smell with a smile. A ceramic diffuser spreads soft mist swirls that turn into pink flower and leaf shapes; a small essential oil bottle with a drop."],
      ["tanning", "برنزه", "Half-body, cool face with round sunglasses and a golden sun-kissed tan, lying under a happy sun with rays; a tanning-lotion bottle in its hand; a small palm leaf."],
      ["body_contour", "لاغری و فرمدهی بدن", "Half-body, confident wink. It holds a yellow measuring tape loosely around its waist, a small cheerful 'curve' sparkle line shaping its figure; a tiny heart."],
      ["perfume", "عطر", "Half-body, delighted closed eyes. It sprays a crystal perfume bottle with a rose-gold cap; the mist forms a cloud of small hearts and sparkles that drifts around."],
      ["sauna", "سونا", "Half-body, relaxed red cheeks and a small sweat drop, wrapped in a white towel, sitting inside a wooden slatted sauna cabin with a bucket and ladle; steam clouds."],
      ["body_scrub", "اسکراب بدن", "Half-body, joyful face. It rubs its arm with a sugar scrub from a small open jar, with sparkling sugar grains and foam bubbles; a loofah in the other hand."],
      ["moroccan_bath", "حمام مراکشی", "Half-body, happy relaxed face, wrapped in a towel, holding a rough scrub mitt, standing in a steamy bath with mosaic-tile pattern behind it (simple geometric pattern), foam and steam."],
      ["hijama", "حجامت", "Half-body, calm focused face, with three round clear cupping glasses placed on its shoulder; a hand sketch of gentle suction rings; a small herbal leaf."],
      ["stone_massage", "ماساژ سنگ داغ", "Half-body, blissful closed eyes lying down with smooth dark warm stones stacked in a line along its back and a tiny steam curl over each; a small green leaf and a candle."],
      ["foot_massage", "ماساژ پا", "Half-body, giggling ticklish face with one foot raised to the viewer being massaged by floating hands; foot reflexology dots on the sole; tiny sparkles."]
    ]
  },
  tattoo: {
    title: "تاتو و پیرسینگ",
    palette: "ink black, coral red, teal, gold",
    items: [
      ["tattoo", "تتو", "Half-body, proud smile showing its arm with a neat small heart-with-wings tattoo; it flexes slightly; ink-drop sparkles around the art."],
      ["gem", "جواهر", "Half-body, wide amazed eyes. It holds a big faceted teal-and-pink gem with white shine lines in both hands; a ring of tiny sparkles."],
      ["henna", "حنا", "Half-body, calm happy face, a raised hand fully decorated with intricate reddish-brown henna floral and paisley patterns; a small cone of henna in the other hand."],
      ["piercing", "پیرسینگ", "Half-body, brave smile, a tiny gold hoop earring with a diamond stud on its ear; a sterile needle and a small star sparkle; clean medical vibe with a white glove outline."],
      ["tattoo_machine", "دستگاه تتو", "Half-body, focused fun face. It holds a vintage-style tattoo machine with coils and a gold needle tip, a drop of black ink on the tip; a tiny ink bottle in the apron pocket."],
      ["permanent_makeup", "میکاپ دائم", "Half-body, calm smile with perfect microbladed brows and a defined lip line shown clearly; a tiny pigment pen and a dot of pigment; sparkles."]
    ]
  },
  wellness: {
    title: "سلامت و تناسب",
    palette: "sage green, soft teal, sunrise orange, white",
    items: [
      ["yoga", "یوگا", "Full-body in a calm tree pose on a teal yoga mat, palms together above, serene closed eyes; the heart-curl glows; small lotus flower and sparkles."],
      ["pilates", "پیلاتس", "Full-body balanced smile, sitting on a big aqua pilates ball with one leg raised and arms out; light motion arcs and a sparkle."],
      ["fitness", "تناسب اندام", "Half-body, determined happy grin with one sweat drop. It lifts a small pink dumbbell with a visible small muscle bump; motion lines."],
      ["meditation", "مدیتیشن", "Full-body, cross-legged, eyes softly closed with a calm smile, a warm glowing orb of light over its lap and a few floating sparkles and a lotus; peaceful aura rings."],
      ["nutrition", "تغذیه و رژیم", "Half-body, happy chewing face. It holds a green bowl of fresh fruit (strawberry, orange slice, kiwi, apple) and a salad leaf; tiny sparkles."],
      ["physio", "فیزیوتراپی", "Half-body, supportive coach face. It stretches an orange resistance band across both hands; a small anatomical-friendly bone-with-sparkle icon; sports headband on the heart-curl."],
      ["counseling", "مشاوره روان‌شناسی", "Half-body, kind listening smile, sitting in a soft armchair with a notepad and a pen; two overlapping speech bubbles with a heart and a sparkle; a cosy small plant."]
    ]
  },
  general: {
    title: "متفرقه",
    palette: "gold, rose, white, bright accent per sticker",
    items: [
      ["rejuvenation", "جوانسازی", "Half-body, glowing refreshed face, rosy cheeks and a bright shine on forehead; a spiral of sparkles unwinding like time turning back with a small hourglass-with-heart; tiny sprout leaf."],
      ["mirror", "آینه", "Half-body, admiring happy face looking into a round gold hand mirror in which a mini reflection (sparkling eyes) is seen; a glint on the glass."],
      ["consult", "مشاوره", "Half-body, friendly talkative face with a speech bubble containing a heart and a small check mark; a notepad and pen in hand; a plain question-free calm look."],
      ["gift", "هدیه", "Half-body, delighted surprised face. It holds a big gift box in pink with a gold ribbon bow, lid slightly lifted with sparkles popping out; confetti."],
      ["vip", "ویژه", "Half-body, cool proud face wearing round gold sunglasses and a shiny gold star badge on the apron; a velvet-rope shape at one side; golden sparkles."],
      ["sparkles", "درخشش", "Half-body, wonder-filled huge eyes, hands raised open; many sparkles of varied sizes (gold, pink, white) burst around in a ring."],
      ["heart", "علاقه‌مندی", "Half-body hugging a big glossy pink heart tightly with closed happy eyes and blushing cheeks; smaller hearts float up."],
      ["rose", "گل رز", "Half-body, shy blush. It holds one long-stem red-pink rose with two green leaves in both hands near its chest; a petal falls; tiny sparkles."],
      ["photoshoot", "عکاسی", "Half-body, fun pose with a wink and a V hand sign; a small camera on a strap in front, a white flash burst and a round reflector disc behind."],
      ["training", "آموزش", "Half-body, teacher pose with round glasses and a mini graduation cap on the heart-curl. It points a stick at a small blackboard showing a drawn heart and star; a stack of books beside."],
      ["home_service", "خدمات در محل", "Full-body, friendly wave with one hand while pulling a pink rolling beauty-kit suitcase with a hair dryer handle sticking out; a tiny house with a heart door behind; small location-pin sparkle."],
      ["discount", "تخفیف", "Half-body, cheerful big grin. It holds up a big round gold price-tag shaped like a percent sign badge (just the % symbol drawn as shapes), ribbon string, confetti."],
      ["kids_care", "ویژه کودکان", "A smaller baby-sized mascot with big head, holding a balloon and a teddy bear, a small party hat; a rattle at its side; extra-round soft look; sparkles."],
      ["express", "سریع و فوری", "Full-body running fast with a little tongue-out determination, speed lines behind, holding a small yellow stopwatch with a lightning bolt on it; a puff of dust at the feet."]
    ]
  }
};

// ---- Part B: situations across the app (not services) ----
export const APP_SCENES = {
  empty: {
    title: "حالت‌های خالی",
    items: [
      ["empty_bookings", "هنوز رزروی ندارم", "Full-body, curious head tilt, holding an empty open calendar page with a big soft question-free blank grid and a small pencil; a few pale sparkles. Friendly, not sad."],
      ["empty_salons", "سالنی پیدا نشد", "Half-body with a big magnifying glass in front of one eye, searching a tiny empty city skyline of three shop fronts; small dotted trail lines."],
      ["empty_posts", "هنوز نمونه‌کاری نیست", "Half-body holding up an empty picture frame and a camera; a dotted rectangle in the frame where a photo will go; a small plus sparkle."],
      ["empty_customers", "هنوز مشتری ندارم", "Full-body standing at a small empty reception desk with a bell and an open guest book; waving hopefully towards the right."],
      ["empty_staff", "تیمی نیست", "Full-body, welcoming open arms next to three empty cosy chairs with name cards (blank) and a heart; invites others."],
      ["empty_services", "خدمتی ثبت نشده", "Half-body with an open empty menu card and a pen, thinking pose; small scissors, brush and lipstick outlines floating around as ideas."],
      ["empty_invites", "دعوتی نداری", "Half-body peeking into an empty open mailbox with a little flag up; a tiny envelope-shaped sparkle floating far away."],
      ["empty_notifications", "اعلانی نیست", "Half-body hugging a sleeping bell that has tiny 'zzz' shapes, calm closed eyes."],
      ["empty_search", "نتیجه‌ای پیدا نشد", "Half-body with a magnifier and a small shrug, one eyebrow up, a tiny dust puff where the result should be; honest, gentle expression."],
      ["empty_saved", "ذخیره‌شده‌ای نیست", "Half-body holding an empty bookmark ribbon and a heart outline, looking at it hopeful; small sparkles."]
    ]
  },
  status: {
    title: "وضعیت رزرو و موفقیت",
    items: [
      ["booking_pending", "در انتظار تأیید", "Full-body sitting patiently with a small hourglass in its lap, hands folded, a soft hopeful smile; a clock-face sparkle."],
      ["booking_confirmed", "رزرو تأیید شد", "Full-body jumping with joy, one fist up, holding a calendar page with a big green check mark; confetti and hearts."],
      ["booking_cancelled", "رزرو لغو شد", "Half-body, gentle sorry face, holding a calendar page with a soft grey X mark; a tiny cloud above; not dramatic."],
      ["booking_expired", "رزرو منقضی شد", "Half-body, surprised face, holding an hourglass with all sand run out and an alarm clock with tiny wings flying away."],
      ["booking_done", "نوبت انجام شد", "Full-body, satisfied happy face with a mirror showing the fresh result, one thumb up, sparkles around the head."],
      ["booking_rebook", "رزرو دوباره", "Half-body, playful wink, holding a calendar page with a circular refresh arrow made of sparkles."],
      ["thank_you", "ممنون", "Half-body, hands pressed together at the chest, a slight bow, rosy cheeks and a warm closed-eye smile; small hearts rise."],
      ["post_published", "پست منتشر شد", "Half-body holding a framed photo high with a sparkly shine and a rocket-less star burst; proud open-mouth smile."],
      ["profile_complete", "پروفایل کامل شد", "Full-body with a small gold medal ribbon on its apron, standing tall with hands on hips and a proud grin; confetti."],
      ["followed", "دنبال کردی", "Half-body hugging a heart with a small plus-turning-into-check sparkle; shy happy smile."]
    ]
  },
  errors: {
    title: "خطا و وضعیت‌های ویژه",
    items: [
      ["error_generic", "خطایی پیش آمد", "Half-body, sheepish apologetic smile, a bandage on the heart-curl, holding a tiny wrench; a small spark from a loose plug; friendly not scary."],
      ["error_offline", "اینترنت قطع است", "Full-body holding a wifi-shaped sparkle arc that is broken with a gap, a small unplugged cable in the other hand, puzzled face."],
      ["error_404", "صفحه پیدا نشد", "Full-body lost with a map held upside down and a magnifier, confused eyes spiral, a small signpost with arrows."],
      ["error_private", "این پروفایل خصوصی است", "Half-body hugging a pink padlock with a heart keyhole, one hand over its mouth in a shh gesture; kind, secretive wink."],
      ["error_login", "وارد شو", "Full-body holding a big golden key and opening a small door shaped like a heart; invites with a friendly wave."],
      ["error_rate_limit", "کمی صبر کن", "Half-body holding a small stop-paw hand gesture and a big hourglass; calm patient smile; tiny sweat drop."],
      ["error_forbidden", "دسترسی نداری", "Half-body behind a small rope barrier with a gold star pole, friendly apologetic face, hands showing 'not this way'."]
    ]
  },
  loading: {
    title: "لودینگ و پردازش (۳ فریم)",
    items: [
      ["loading_1", "لودینگ ۱", "Half-body, curl-heart bouncing down, brush mid-air starting a stroke, small motion arc left."],
      ["loading_2", "لودینگ ۲", "Same pose as loading_1 but brush mid-sweep in the center, curl tilted, a pink swish line trailing."],
      ["loading_3", "لودینگ ۳", "Same pose, brush finishing the stroke to the right, curl bouncing up, a sparkle at the end of the swish."],
      ["uploading", "در حال آپلود", "Half-body holding a framed photo up toward a small cloud with an up arrow, sparkles flowing along the arrow."],
      ["processing", "در حال پردازش", "Half-body wearing a tiny chef-like cap-free cheerful face turning a small gear and a spoon over a bubbling pot with sparkles (cooking the result)."]
    ]
  },
  roles: {
    title: "نقش‌ها و ارتباط‌ها",
    items: [
      ["role_client", "مشتری", "Half-body, stylish and excited, holding a smartphone showing a heart and a shopping-bag-free calendar, a small sparkling tote bag; no apron colour change but a light scarf."],
      ["role_artist", "آرتیست", "Half-body, brush and palette in hands, a beret-free cheerful expression, apron with colourful paint dots; sparkles."],
      ["role_salon", "سالن", "Full-body standing proudly in front of a small cute shopfront with an awning in pink and white stripes and a heart sign; hands on hips."],
      ["invite_received", "دعوت‌نامه", "Half-body opening a glowing envelope with a heart seal from which a paper note and sparkles rise; surprised delighted face."],
      ["invite_sent", "دعوت فرستاده شد", "Half-body folding a paper plane with a heart on the wing and tossing it; a dotted flight trail with sparkles."],
      ["team_join", "پیوستن به تیم", "Full-body shaking hands with a second smaller identical mascot silhouette-free partner (a second mascot in lighter palette), hearts above."],
      ["team_leave", "ترک تیم", "Full-body, gentle goodbye wave with a small bag over the shoulder walking toward a door; soft smile, a tiny heart left behind."],
      ["qr_join", "اسکن QR", "Half-body holding a phone toward a big abstract QR code (just a pattern of black and pink squares, no real code) with a scanning beam line and sparkles."],
      ["collab_proposal", "پیشنهاد همکاری", "Half-body holding a rolled certificate-like scroll tied with a pink ribbon and extending it forward with both hands; hopeful smile."],
      ["revenue_share", "سهم همکاری", "Half-body holding a pie chart divided into a pink and a gold slice, pointing at the slice with a stick; a small coin sparkle."]
    ]
  },
  reactions: {
    title: "ری‌اکشن‌ها (ایموجی‌های چت/اعلان)",
    items: [
      ["react_thanks", "ممنون", "Head-and-shoulders, hands together at the chest, eyes closed, warm smile, small hearts."],
      ["react_ok", "اوکی", "Head-and-shoulders, one hand making the OK circle sign next to its face, confident wink."],
      ["react_laugh_tears", "خنده اشکی", "Head-and-shoulders, laughing with mouth wide, big blue tear drops flying from the eyes, holding its tummy."],
      ["react_surprised", "تعجب", "Head-and-shoulders, huge eyes and tiny open mouth, both hands on cheeks, small impact lines around the head."],
      ["react_sleepy", "خواب‌آلود", "Head-and-shoulders, half-closed eyes, a yawn, a tiny sleeping cap on the curl, wavy z-curls floating."],
      ["react_party", "جشن", "Head-and-shoulders, mouth open in a cheer with a party hat, confetti raining."],
      ["react_love", "عاشق", "Head-and-shoulders, heart-shaped eyes, hands holding a big heart, tiny hearts floating."],
      ["react_thumbs_up", "عالیه", "Head-and-shoulders, big grin, strong thumbs-up, a star glint on the thumb."],
      ["react_thinking", "فکر کردن", "Head-and-shoulders, hand on chin, looking up with a thinking bubble made of three growing circles and a sparkle."],
      ["react_shy", "خجالتی", "Head-and-shoulders, big blush, covering half the face with both hands and peeking through fingers."],
      ["react_sad", "ناراحت", "Head-and-shoulders, teary shiny eyes, wobbly mouth, one tear, a little rain cloud above the curl."],
      ["react_wow_fire", "آتیش", "Head-and-shoulders, confident cool face with sunglasses, small flames of warm orange around the shoulders, sparkles."]
    ]
  },
  brand: {
    title: "برند و صفحه‌های بزرگ",
    items: [
      ["brand_icon", "آیکن اپ", "Head only, perfectly centered, larger, cheerful face with the heart-curl, brush behind the ear; a clean silhouette so it stays clear at 48px; no body."],
      ["brand_hero", "هیرو صفحه اول", "Full-body, waving hello with a welcoming open smile, standing at the center, a few floating beauty props (scissors, lipstick, hair dryer, nail polish, mirror) drawn small orbiting around with sparkles. Square 1:1."],
      ["brand_welcome", "خوش‌آمدی", "Full-body holding a small welcome banner-free sign shaped like a heart and a bouquet; bowing slightly with hearts around."],
      ["brand_splash", "اسپلش", "Full-body mid-jump with arms up and a trail of sparkles forming a circle, joyful closed-eye grin."],
      ["brand_404_hair", "تصویر پشت لودینگ برند", "Half-body, brush painting a pink heart in the air; the heart glows."]
    ]
  }
};

// ---- Adapter for scripts/mascot-prompts.mjs (nested SECTIONS shape) ----
const toGroups = (obj) => Object.entries(obj).map(([key, g]) => ({
  key,
  title: g.title,
  items: g.items.map(([id, fa, scene]) => ({ id, fa, scene }))
}));
export const SECTIONS = [
  { key: "A", title: "بخش الف · خدمات", groups: toGroups(SERVICE_SCENES) },
  { key: "B", title: "بخش ب · موقعیت‌های برنامه", groups: toGroups(APP_SCENES) }
];
export const EXPECTED_COUNTS = { A: 109, B: 59 };
export const CHARACTER_LOCK = "Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.";
export const STYLE_LOCK = "Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.";
