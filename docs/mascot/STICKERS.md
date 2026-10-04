# لیست استیکرهای ماسکات

> این فایل خودکار ساخته می‌شود. دستی ویرایش نکنید؛ داده‌ها را در `scripts/mascot-data.mjs` تغییر دهید و `node scripts/mascot-prompts.mjs` را اجرا کنید.

## روش کار

1. تصویر مرجع (برگه‌ی شخصیت) را همراه **هر** پرامپت به ابزار تولید تصویر بدهید.
2. هر پرامپت فقط **یک** تصویر مربع با پس‌زمینه‌ی سفید خالص می‌سازد.
3. خروجی را با نام دقیق فایل در `assets/mascot/raw/` بگذارید (مثلاً `haircut.png`).
4. اسکریپت را دوباره اجرا کنید؛ وضعیت‌ها خودکار به‌روز می‌شوند.

قواعد ثابت: بدون متن داخل تصویر، بدون بنفش، بدون قاب یا پس‌زمینه‌ی رنگی، خوانا در ۴۸ پیکسل.

وضعیت‌ها: ⬜ ساخته نشده · 🟡 ساخته شد (`raw/<id>.png`) · ✅ پردازش شد (`stickers/<id>.webp`)

## پیشرفت

**کل: 0 از 168 ساخته شد · 0 پردازش شد**

| بخش | گروه | تعداد | ساخته شد | پردازش شد |
|---|---|---:|---:|---:|
| بخش الف · خدمات | [مو](#g-a-hair) | 19 | 0 | 0 |
| بخش الف · خدمات | [آقایان](#g-a-men) | 5 | 0 | 0 |
| بخش الف · خدمات | [آرایش](#g-a-makeup) | 8 | 0 | 0 |
| بخش الف · خدمات | [عروس و مراسم](#g-a-bridal) | 5 | 0 | 0 |
| بخش الف · خدمات | [ابرو و مژه](#g-a-brow_lash) | 7 | 0 | 0 |
| بخش الف · خدمات | [ناخن](#g-a-nails) | 7 | 0 | 0 |
| بخش الف · خدمات | [پوست](#g-a-skin) | 10 | 0 | 0 |
| بخش الف · خدمات | [کلینیک](#g-a-clinic) | 8 | 0 | 0 |
| بخش الف · خدمات | [بدن و اسپا](#g-a-body) | 13 | 0 | 0 |
| بخش الف · خدمات | [تاتو و پیرسینگ](#g-a-tattoo) | 6 | 0 | 0 |
| بخش الف · خدمات | [سلامت و تناسب](#g-a-wellness) | 7 | 0 | 0 |
| بخش الف · خدمات | [متفرقه](#g-a-general) | 14 | 0 | 0 |
| بخش ب · موقعیت‌های برنامه | [حالت‌های خالی](#g-b-empty) | 10 | 0 | 0 |
| بخش ب · موقعیت‌های برنامه | [وضعیت رزرو و موفقیت](#g-b-status) | 10 | 0 | 0 |
| بخش ب · موقعیت‌های برنامه | [خطا و وضعیت‌های ویژه](#g-b-errors) | 7 | 0 | 0 |
| بخش ب · موقعیت‌های برنامه | [لودینگ و پردازش (۳ فریم)](#g-b-loading) | 5 | 0 | 0 |
| بخش ب · موقعیت‌های برنامه | [نقش‌ها و ارتباط‌ها](#g-b-roles) | 10 | 0 | 0 |
| بخش ب · موقعیت‌های برنامه | [ری‌اکشن‌ها (ایموجی‌های چت/اعلان)](#g-b-reactions) | 12 | 0 | 0 |
| بخش ب · موقعیت‌های برنامه | [برند و صفحه‌های بزرگ](#g-b-brand) | 5 | 0 | 0 |

## بخش الف · خدمات

<a id="g-a-hair"></a>

### مو (19)

#### ⬜ 001 · کوتاهی مو · `haircut.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, proud little grin. It holds a pair of big silver scissors with red-coral handles in one hand and snips a single lock of its own orange curl, which falls in a small arc. Three tiny orange hair clippings and one yellow sparkle float around the scissors.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 002 · رنگ مو · `hair_color.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, concentrated happy face with the tongue tip slightly out. One hand holds a round teal tint bowl full of glossy orange dye, the other a wide flat tint brush loaded with dye; a fresh orange-to-pink stripe is painted on one of its curls. A couple of dye drops fall into the bowl.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 003 · لایت و هایلایت · `highlights.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, confident wink. Its curl has bright golden-blonde streaks that glow; one hand holds a silver foil strip wrapped around a streak, the other a small tint brush. Three yellow sparkles shine on the streaks.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 004 · براشینگ و سشوار · `blowdry.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, eyes squeezed happily shut, mouth open in a laugh. It holds a coral-red hair dryer with a dark-ink nozzle; a warm wind of three light-blue curved air lines makes its curls and heart-curl bounce sideways. A round brush sticks out of its apron pocket.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 005 · شینیون و مدل مو · `updo.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, elegant calm smile, chin slightly raised. Its curls are gathered into a neat high bun with a gold hair pin topped by a small pearl; a couple of curled strands fall by its cheeks. It holds up a second pearl pin between two fingers. Gold sparkles around the bun.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 006 · حالت‌دهی و فر · `hair_styling.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, playful open smile. It holds a hot-pink curling iron, a long ringlet of orange hair wound round it; a perfect spiral curl bounces down. Small steam puffs and sparkles rise from the iron.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 007 · کراتین و احیا · `keratin.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, blissful closed eyes. Its hair is super smooth, long and silky with big white shine streaks. It holds a small amber treatment bottle with a gold cap, a sparkling droplet above it and a tiny shield-with-a-heart badge on the bottle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 008 · اکستنشن مو · `hair_extension.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, surprised-delighted wide eyes. Both hands proudly hold a long glossy orange hair extension piece stretched like a ribbon, with a small clip at the top; the piece shines with a white highlight. Sparkles around.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 009 · بافت مو · `braid.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, focused cheerful smile. Its orange hair falls in a long thick braid over one shoulder, tied with a rose-pink ribbon bow; its hand is finishing the last cross of the braid. Two tiny flowers tucked in the braid.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 010 · شستشو و ماسک مو · `hair_wash.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body in a fluffy white bubble-foam hat made of soap bubbles on its head, eyes closed in joy. It holds a mint-green shampoo bottle with a drop on the bottle; many round soap bubbles with white glints float around.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 011 · برس و شانه · `comb.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, gentle happy smile, one eye winking. It combs one long orange lock with a big wide-tooth tortoise-shell comb; a smooth shine streak runs along the lock. A wooden paddle brush rests in its other hand.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 012 · بوتاکس مو · `hair_botox.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, relaxed smile. It holds a small glass jar of creamy pearl-white treatment with a gold lid and a little spatula; above the jar a soft sparkling swirl rises and wraps into a shiny wave of hair.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 013 · فر دائم · `hair_perm.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, wide excited eyes. Its hair is full of tight springy ringlets and three pink hair curlers are still rolled in at the top; it bounces a ringlet with one finger like a spring (boing lines). Sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 014 · مراقبت پوست سر · `scalp_care.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, blissful closed eyes, big happy smile. Two small hands (not its own — floating cream-coloured hands with ink outline) massage its head; tiny calm sparkles and little leaf shapes around, mint-green scalp-serum dropper in front.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 015 · درمان ریزش مو · `hair_loss.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, hopeful small smile. It holds a dropper bottle of green hair-growth serum; one bald-looking spot on its head now shows a tiny green sprout with two leaves. A small upward arrow made of sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 016 · کاشت مو · `hair_transplant.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brave determined face. It holds fine tweezers carefully planting a tiny orange hair strand; a small neat row of new strands is already planted, each with a tiny sparkle. A mini dotted-line planting grid hovers on its head.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 017 · کوتاهی کودک · `kids_haircut.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: A smaller baby-sized version of the mascot (bigger head, shorter curl) sitting on a booster seat with a yellow cape tied at the neck, giggling; a tiny comb in one hand, a lollipop in the other. Tiny clipped curl pieces fall; a balloon floats behind.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 018 · رنگ ریشه · `root_touch.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, careful concentrated face. It parts its hair with one hand showing a visible root line and with the other applies orange dye with a thin brush exactly at the base; a small tint dish with a brush rests on its shoulder. A neat, thin glow line at the roots.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 019 · صافی مو · `hair_straight.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, satisfied smug smile. It holds a rose-gold flat iron; the half of its hair above is perfectly poker-straight and glossy, the part below still curly — proud before/after look. Shine lines and sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-men"></a>

### آقایان (5)

#### ⬜ 020 · آرایشگر مردانه · `barber.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, cool proud smile. It wears a striped red-white-navy barber cape collar and stands in front of a red-white-blue barber pole; one hand holds electric clippers, the other a comb. Tiny clipped hair bits and a sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 021 · ریش · `beard.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, proud smile. It sports a big fluffy brown-copper beard shaped neatly with sharp edges, brushing it with a small beard brush; a tiny bottle of beard oil in its apron pocket. Two sparkles on the beard.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 022 · اصلاح با تیغ · `razor.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, careful calm face. Its chin and cheeks are covered in white shaving-foam beard; it holds a classic straight razor with a wooden handle, one clean stripe already shaved through the foam. Little foam bubbles float.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 023 · کوتاهی مردانه · `men_cut.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, confident wink. Its orange curls are trimmed into a clean sharp fade with a short quiff and the heart curl still on top; it holds a hand mirror showing the back of its fresh cut. Fresh-cut sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 024 · داماد · `groom.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, bashful happy face with blushing cheeks. It wears a navy tuxedo jacket over its apron, a white shirt, a red bow tie and a small white boutonniere flower; hair slicked neat. A tiny gold ring box in one hand.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-makeup"></a>

### آرایش (8)

#### ⬜ 025 · آرایش (لیپ‌استیک) · `lipstick.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, flirty wink. It holds up a big open rose-pink lipstick with a gold case; its own lips show a glossy rose smile. A kiss-mark and a sparkle near the lipstick.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 026 · سایه چشم · `eyeshadow.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, one eye closed to show a glowing rose-gold shimmer eyeshadow with a tiny glitter fleck, the other eye open and sparkling. It holds a small eyeshadow brush and a mini round compact.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 027 · کانتور و براش · `makeup_brush.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, happy dreamy face. It sweeps a huge fluffy blush brush across its cheek leaving a pink powder cloud with sparkles; the brush has a rose-gold handle. A tiny contour stick in the apron pocket.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 028 · لب · `lips.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Close-up style bust, eyes sparkling, blowing a kiss: glossy rose-pink lips and a small heart floating away with a motion trail; a lip-gloss wand in the other hand with a shiny droplet.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 029 · پالت آرایشی · `palette.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, delighted wide-open eyes and open smile. It hugs a huge open makeup palette with 6 colourful pans (rose, peach, gold, mint, sky-blue, coral) and a tiny mirror in the lid; a mini brush in the other hand. Sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 030 · خط چشم · `eyeliner.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, concentrated look with the tongue slightly out. It draws a perfect winged black eyeliner on its own eye with a thin pen held in a steady hand; a tiny dotted guide line and a sparkle at the wing tip.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 031 · آموزش آرایش · `makeup_lesson.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, teacher pose with small round glasses. It points a stick at a small whiteboard showing a simple face chart with arrows and a heart; a makeup brush behind the ear, a tiny graduation cap on the heart-curl.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 032 · آرایش مجلسی · `party_makeup.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, starry-eyed glamorous look with gold glitter eyelids, long lashes and deep rose lips; a small sparkling tiara pin, a mini disco-ball and confetti around; a champagne-pink tone.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-bridal"></a>

### عروس و مراسم (5)

#### ⬜ 033 · عروس · `bridal.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, teary happy eyes, hands clasped under the chin. It wears a long sheer white veil with a lace edge fixed by a small flower crown, a pink apron changed to a white bodice, and holds a small bouquet. Floating hearts and sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 034 · تاج · `crown.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, regal proud smile, chin up. A sparkling gold crown with three round rubies and tiny pearls sits between its curls and the heart-curl; it holds a small royal sceptre with a star. Gold sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 035 · دسته گل · `bouquet.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, shy happy face with blushing cheeks. It holds a big round bouquet of pink roses, white peonies and green leaves tied with a satin ribbon bow; a few petals fall.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 036 · حلقه · `ring.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, starry eyes, mouth open in awe. It holds up a shiny gold ring with a big sparkling blue-white diamond between two fingers; a big four-point shine flares on the diamond and tiny hearts float.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 037 · جشن و مراسم · `party.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, laughing mouth wide open, eyes closed in joy. It wears a striped party hat on the heart-curl, pops a party popper with confetti, and a small string of triangle flags hangs behind. Colourful confetti in rose, gold, mint, sky.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-brow_lash"></a>

### ابرو و مژه (7)

#### ⬜ 038 · ابرو · `eyebrow.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, calm confident smile. Its eyebrows are perfectly shaped thick arches (drawn clearly); it holds a brow pencil in one hand and a spoolie brush in the other. A tiny shine mark above the brow.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 039 · اکستنشن مژه · `lash_ext.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, dreamy eyes with very long fluttery curled lashes (clearly bigger lashes). It holds fine tweezers with one single lash; a mini lash tile with lashes rests on its apron. Sparkles at the lash tips.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 040 · لیفت مژه · `lash_lift.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, one eye wide to show lifted curled lashes, the other with a small silver lash curler clamped on. A tiny upward curve arrow and sparkles show the lift.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 041 · لمینت ابرو · `brow_lamination.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, smug smile. Its eyebrows are fluffy and brushed upward in a neat laminated style with a glossy shine; it brushes one up with a spoolie while holding a tiny glossy-gel tube.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 042 · رنگ ابرو · `brow_tint.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, focused face. It holds a tiny glass dish with dark brown dye and a thin brush, painting one brow darker — one brow done and rich brown, the other still light. A drop of dye sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 043 · نخ‌کشی صورت · `threading.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brave concentrated face. It holds a thin white thread stretched between both hands and the teeth, twisted in the middle in the typical threading X shape; tiny hair bits fly away; a sparkle on the cleanly shaped brow.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 044 · رنگ مژه · `lash_tint.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, calm closed eye showing thick dark tinted lashes with a tiny brush beside it, and a miniature tint dish with a black dye. Small sparkles on the lashes.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-nails"></a>

### ناخن (7)

#### ⬜ 045 · مانیکور · `manicure.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, big happy grin, one hand raised flat to the viewer showing perfectly painted rose-red nails with white shine marks; a tiny nail file in the other hand. Sparkles around the fingertips.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 046 · پدیکور · `pedicure.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, relaxed happy face. One foot rests on a small stool with toe separators and freshly painted coral toenails, a little footbath with petals and bubbles beside it, a towel on the shoulder. Sparkles on the toes.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 047 · نیل‌آرت · `nail_art.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, excited wide eyes. The nails show tiny art: a heart, a star, polka dots and a gem on different fingers; it holds a thin dotting tool and a tiny rhinestone. Glitter sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 048 · ناخن ژله‌ای · `gel_nails.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, relaxed smile. Its hand sits under a small pink UV nail lamp (pink body) that glows with soft light; the gel nails shine like glass with a big white glint.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 049 · لاک · `nail_polish.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, proud grin. It holds a big nail-polish bottle (hot-pink, black cap) with a brush dripping one shiny drop, and shows a single freshly painted nail with a glossy line. Sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 050 · فرنچ · `french_nails.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, elegant smile. One raised hand shows classic French-tip nails (nude base with crisp white tips) in clear detail; a small bottle of white tip polish is in the apron pocket. White glints.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 051 · اسپای دست · `nail_spa.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, blissful closed eyes. Both hands soak in a small round bowl of milky water with pink flower petals and bubbles; steam curls above; a mini towel on its shoulder.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-skin"></a>

### پوست (10)

#### ⬜ 052 · فیشیال · `facial.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, relaxed with eyes closed and happy smile. Two round cucumber slices rest over its eyes, a pale-green clay mask covers its cheeks, a white headband holds the curls. Water drops and leaves sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 053 · مراقبت پوست · `skincare.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, glowing happy face with shiny cheeks. It pats a pearl-white cream onto its cheek with fingers, holding a small round cream jar with a gold lid; a lifted shine arc on the cheek. Sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 054 · سرم پوست · `serum.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, delighted look at the dropper. It holds a glass serum bottle with a gold dropper cap, a glowing yellow drop falling toward its cheek; a shiny crystal-clear droplet icon above.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 055 · هیدرافیشیال · `hydrafacial.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, refreshed happy face. A small white-and-aqua hydra-wand device with a spiral tip glides near its cheek, with water swirl lines and bubbles; skin glows with a shine arc.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 056 · پیلینگ · `peeling.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, funny surprised-but-ok face. A thin translucent peeling mask is being lifted from one cheek by two fingers, revealing smooth glowing skin under it; tiny flakes float. Sparkles on the clear cheek.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 057 · میکرونیدلینگ · `microneedling.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brave smile with small sweat drop. It holds a small silver derma-roller pen with fine needles pointing to its cheek; a tiny sparkling dot trail on the skin and a shine.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 058 · ماسک صورت · `face_mask.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body wearing a white sheet face mask with eye and mouth holes, only its big shiny eyes and little mouth visible; calm bliss. A little bowl of mint-green gel and leaves.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 059 · درمان جوش · `acne.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, hopeful smile. A round pimple patch with a sparkling star sits on its cheek; it holds a small tube of blue spot treatment. Small clean-skin sparkles in a ring.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 060 · اکسیژن فیشیال · `oxygen_facial.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, eyes closed refreshed face. A light-blue oxygen spray mist falls on its face from a small nozzle; many round oxygen bubbles with the O2 shape rise around.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 061 · لایت‌تراپی (LED) · `led_therapy.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body wearing a glowing LED face mask with soft pink and blue light panels; relaxed smile in the eye holes; light rays and sparkles radiate softly.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-clinic"></a>

### کلینیک (8)

#### ⬜ 062 · تزریق · `injection.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, calm professional smile. It wears a tiny white nurse cap on the heart-curl and holds a clear syringe with a pink liquid, one drop at the needle tip; a small plus-heart sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 063 · لیزر · `laser.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body with clear safety goggles, focused face. It holds a sleek white-and-blue laser device with a thin beam of teal light and star sparkles at the tip; a small shield icon glow.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 064 · دندان · `teeth.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, huge bright grin showing neat white teeth with a star shine on one tooth; it holds a pink toothbrush with minty paste; a tiny tooth with a sparkle icon near.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 065 · فیلر · `filler.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, soft smile. A small clear syringe with a gel drop is held near its plump cheek; the cheek and lips look gently plump with a shine; sparkles. Tiny pink heart.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 066 · پی‌آر‌پی · `prp.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, calm smile. It holds a test tube of golden-yellow plasma beside a second one of red; a tiny centrifuge icon shape behind; sparkling droplets.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 067 · هایفو · `hifu.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, upbeat face with a visibly lifted cheek line. A white ultrasound probe with a blue tip sends three concentric wave arcs toward the cheek; small up-arrows of sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 068 · لیفت با نخ · `thread_lift.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brave smile. Very thin golden threads curve along the cheek line lifting it, a fine needle in a hand; two sparkles at the lifted jaw.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 069 · ویزیت پزشک · `doctor.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, friendly confident smile. It wears a white doctor coat with a stethoscope and a round head mirror, holds a clipboard with a heart-rate line; a small first-aid cross badge.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-body"></a>

### بدن و اسپا (13)

#### ⬜ 070 · اپیلاسیون و واکس · `waxing.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brave-but-nervous wavy smile with one tiny sweat drop. It holds a wooden wax spatula with golden warm wax and a small wax pot with steam; a strip of cloth in the other hand.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 071 · ماساژ · `massage.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, blissful closed eyes lying face-down on a spa table with a white towel, a sage-green towel roll under its chin; two floating cream hands massage its back; small calm sparkles and a flower.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 072 · اسپا · `spa.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, relaxed smile, wearing a fluffy white bathrobe with a towel turban on its hair, next to a lit candle, stacked smooth stones and a green leaf; warm steam swirls.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 073 · آروماتراپی · `aroma.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, eyes closed, deep smell with a smile. A ceramic diffuser spreads soft mist swirls that turn into pink flower and leaf shapes; a small essential oil bottle with a drop.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 074 · برنزه · `tanning.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, cool face with round sunglasses and a golden sun-kissed tan, lying under a happy sun with rays; a tanning-lotion bottle in its hand; a small palm leaf.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 075 · لاغری و فرمدهی بدن · `body_contour.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, confident wink. It holds a yellow measuring tape loosely around its waist, a small cheerful 'curve' sparkle line shaping its figure; a tiny heart.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 076 · عطر · `perfume.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, delighted closed eyes. It sprays a crystal perfume bottle with a rose-gold cap; the mist forms a cloud of small hearts and sparkles that drifts around.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 077 · سونا · `sauna.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, relaxed red cheeks and a small sweat drop, wrapped in a white towel, sitting inside a wooden slatted sauna cabin with a bucket and ladle; steam clouds.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 078 · اسکراب بدن · `body_scrub.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, joyful face. It rubs its arm with a sugar scrub from a small open jar, with sparkling sugar grains and foam bubbles; a loofah in the other hand.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 079 · حمام مراکشی · `moroccan_bath.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, happy relaxed face, wrapped in a towel, holding a rough scrub mitt, standing in a steamy bath with mosaic-tile pattern behind it (simple geometric pattern), foam and steam.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 080 · حجامت · `hijama.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, calm focused face, with three round clear cupping glasses placed on its shoulder; a hand sketch of gentle suction rings; a small herbal leaf.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 081 · ماساژ سنگ داغ · `stone_massage.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, blissful closed eyes lying down with smooth dark warm stones stacked in a line along its back and a tiny steam curl over each; a small green leaf and a candle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 082 · ماساژ پا · `foot_massage.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, giggling ticklish face with one foot raised to the viewer being massaged by floating hands; foot reflexology dots on the sole; tiny sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-tattoo"></a>

### تاتو و پیرسینگ (6)

#### ⬜ 083 · تتو · `tattoo.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, proud smile showing its arm with a neat small heart-with-wings tattoo; it flexes slightly; ink-drop sparkles around the art.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 084 · جواهر · `gem.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, wide amazed eyes. It holds a big faceted teal-and-pink gem with white shine lines in both hands; a ring of tiny sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 085 · حنا · `henna.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, calm happy face, a raised hand fully decorated with intricate reddish-brown henna floral and paisley patterns; a small cone of henna in the other hand.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 086 · پیرسینگ · `piercing.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brave smile, a tiny gold hoop earring with a diamond stud on its ear; a sterile needle and a small star sparkle; clean medical vibe with a white glove outline.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 087 · دستگاه تتو · `tattoo_machine.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, focused fun face. It holds a vintage-style tattoo machine with coils and a gold needle tip, a drop of black ink on the tip; a tiny ink bottle in the apron pocket.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 088 · میکاپ دائم · `permanent_makeup.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, calm smile with perfect microbladed brows and a defined lip line shown clearly; a tiny pigment pen and a dot of pigment; sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-wellness"></a>

### سلامت و تناسب (7)

#### ⬜ 089 · یوگا · `yoga.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body in a calm tree pose on a teal yoga mat, palms together above, serene closed eyes; the heart-curl glows; small lotus flower and sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 090 · پیلاتس · `pilates.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body balanced smile, sitting on a big aqua pilates ball with one leg raised and arms out; light motion arcs and a sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 091 · تناسب اندام · `fitness.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, determined happy grin with one sweat drop. It lifts a small pink dumbbell with a visible small muscle bump; motion lines.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 092 · مدیتیشن · `meditation.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body, cross-legged, eyes softly closed with a calm smile, a warm glowing orb of light over its lap and a few floating sparkles and a lotus; peaceful aura rings.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 093 · تغذیه و رژیم · `nutrition.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, happy chewing face. It holds a green bowl of fresh fruit (strawberry, orange slice, kiwi, apple) and a salad leaf; tiny sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 094 · فیزیوتراپی · `physio.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, supportive coach face. It stretches an orange resistance band across both hands; a small anatomical-friendly bone-with-sparkle icon; sports headband on the heart-curl.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 095 · مشاوره روان‌شناسی · `counseling.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, kind listening smile, sitting in a soft armchair with a notepad and a pen; two overlapping speech bubbles with a heart and a sparkle; a cosy small plant.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-a-general"></a>

### متفرقه (14)

#### ⬜ 096 · جوانسازی · `rejuvenation.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, glowing refreshed face, rosy cheeks and a bright shine on forehead; a spiral of sparkles unwinding like time turning back with a small hourglass-with-heart; tiny sprout leaf.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 097 · آینه · `mirror.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, admiring happy face looking into a round gold hand mirror in which a mini reflection (sparkling eyes) is seen; a glint on the glass.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 098 · مشاوره · `consult.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, friendly talkative face with a speech bubble containing a heart and a small check mark; a notepad and pen in hand; a plain question-free calm look.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 099 · هدیه · `gift.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, delighted surprised face. It holds a big gift box in pink with a gold ribbon bow, lid slightly lifted with sparkles popping out; confetti.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 100 · ویژه · `vip.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, cool proud face wearing round gold sunglasses and a shiny gold star badge on the apron; a velvet-rope shape at one side; golden sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 101 · درخشش · `sparkles.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, wonder-filled huge eyes, hands raised open; many sparkles of varied sizes (gold, pink, white) burst around in a ring.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 102 · علاقه‌مندی · `heart.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body hugging a big glossy pink heart tightly with closed happy eyes and blushing cheeks; smaller hearts float up.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 103 · گل رز · `rose.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, shy blush. It holds one long-stem red-pink rose with two green leaves in both hands near its chest; a petal falls; tiny sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 104 · عکاسی · `photoshoot.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, fun pose with a wink and a V hand sign; a small camera on a strap in front, a white flash burst and a round reflector disc behind.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 105 · آموزش · `training.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, teacher pose with round glasses and a mini graduation cap on the heart-curl. It points a stick at a small blackboard showing a drawn heart and star; a stack of books beside.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 106 · خدمات در محل · `home_service.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body, friendly wave with one hand while pulling a pink rolling beauty-kit suitcase with a hair dryer handle sticking out; a tiny house with a heart door behind; small location-pin sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 107 · تخفیف · `discount.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, cheerful big grin. It holds up a big round gold price-tag shaped like a percent sign badge (just the % symbol drawn as shapes), ribbon string, confetti.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 108 · ویژه کودکان · `kids_care.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: A smaller baby-sized mascot with big head, holding a balloon and a teddy bear, a small party hat; a rattle at its side; extra-round soft look; sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 109 · سریع و فوری · `express.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body running fast with a little tongue-out determination, speed lines behind, holding a small yellow stopwatch with a lightning bolt on it; a puff of dust at the feet.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

## بخش ب · موقعیت‌های برنامه

<a id="g-b-empty"></a>

### حالت‌های خالی (10)

#### ⬜ 110 · هنوز رزروی ندارم · `empty_bookings.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body, curious head tilt, holding an empty open calendar page with a big soft question-free blank grid and a small pencil; a few pale sparkles. Friendly, not sad.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 111 · سالنی پیدا نشد · `empty_salons.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body with a big magnifying glass in front of one eye, searching a tiny empty city skyline of three shop fronts; small dotted trail lines.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 112 · هنوز نمونه‌کاری نیست · `empty_posts.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding up an empty picture frame and a camera; a dotted rectangle in the frame where a photo will go; a small plus sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 113 · هنوز مشتری ندارم · `empty_customers.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body standing at a small empty reception desk with a bell and an open guest book; waving hopefully towards the right.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 114 · تیمی نیست · `empty_staff.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body, welcoming open arms next to three empty cosy chairs with name cards (blank) and a heart; invites others.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 115 · خدمتی ثبت نشده · `empty_services.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body with an open empty menu card and a pen, thinking pose; small scissors, brush and lipstick outlines floating around as ideas.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 116 · دعوتی نداری · `empty_invites.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body peeking into an empty open mailbox with a little flag up; a tiny envelope-shaped sparkle floating far away.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 117 · اعلانی نیست · `empty_notifications.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body hugging a sleeping bell that has tiny 'zzz' shapes, calm closed eyes.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 118 · نتیجه‌ای پیدا نشد · `empty_search.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body with a magnifier and a small shrug, one eyebrow up, a tiny dust puff where the result should be; honest, gentle expression.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 119 · ذخیره‌شده‌ای نیست · `empty_saved.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding an empty bookmark ribbon and a heart outline, looking at it hopeful; small sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-b-status"></a>

### وضعیت رزرو و موفقیت (10)

#### ⬜ 120 · در انتظار تأیید · `booking_pending.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body sitting patiently with a small hourglass in its lap, hands folded, a soft hopeful smile; a clock-face sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 121 · رزرو تأیید شد · `booking_confirmed.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body jumping with joy, one fist up, holding a calendar page with a big green check mark; confetti and hearts.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 122 · رزرو لغو شد · `booking_cancelled.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, gentle sorry face, holding a calendar page with a soft grey X mark; a tiny cloud above; not dramatic.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 123 · رزرو منقضی شد · `booking_expired.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, surprised face, holding an hourglass with all sand run out and an alarm clock with tiny wings flying away.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 124 · نوبت انجام شد · `booking_done.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body, satisfied happy face with a mirror showing the fresh result, one thumb up, sparkles around the head.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 125 · رزرو دوباره · `booking_rebook.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, playful wink, holding a calendar page with a circular refresh arrow made of sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 126 · ممنون · `thank_you.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, hands pressed together at the chest, a slight bow, rosy cheeks and a warm closed-eye smile; small hearts rise.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 127 · پست منتشر شد · `post_published.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding a framed photo high with a sparkly shine and a rocket-less star burst; proud open-mouth smile.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 128 · پروفایل کامل شد · `profile_complete.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body with a small gold medal ribbon on its apron, standing tall with hands on hips and a proud grin; confetti.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 129 · دنبال کردی · `followed.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body hugging a heart with a small plus-turning-into-check sparkle; shy happy smile.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-b-errors"></a>

### خطا و وضعیت‌های ویژه (7)

#### ⬜ 130 · خطایی پیش آمد · `error_generic.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, sheepish apologetic smile, a bandage on the heart-curl, holding a tiny wrench; a small spark from a loose plug; friendly not scary.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 131 · اینترنت قطع است · `error_offline.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body holding a wifi-shaped sparkle arc that is broken with a gap, a small unplugged cable in the other hand, puzzled face.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 132 · صفحه پیدا نشد · `error_404.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body lost with a map held upside down and a magnifier, confused eyes spiral, a small signpost with arrows.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 133 · این پروفایل خصوصی است · `error_private.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body hugging a pink padlock with a heart keyhole, one hand over its mouth in a shh gesture; kind, secretive wink.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 134 · وارد شو · `error_login.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body holding a big golden key and opening a small door shaped like a heart; invites with a friendly wave.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 135 · کمی صبر کن · `error_rate_limit.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding a small stop-paw hand gesture and a big hourglass; calm patient smile; tiny sweat drop.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 136 · دسترسی نداری · `error_forbidden.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body behind a small rope barrier with a gold star pole, friendly apologetic face, hands showing 'not this way'.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-b-loading"></a>

### لودینگ و پردازش (۳ فریم) (5)

#### ⬜ 137 · لودینگ ۱ · `loading_1.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, curl-heart bouncing down, brush mid-air starting a stroke, small motion arc left.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 138 · لودینگ ۲ · `loading_2.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Same pose as loading_1 but brush mid-sweep in the center, curl tilted, a pink swish line trailing.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 139 · لودینگ ۳ · `loading_3.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Same pose, brush finishing the stroke to the right, curl bouncing up, a sparkle at the end of the swish.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 140 · در حال آپلود · `uploading.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding a framed photo up toward a small cloud with an up arrow, sparkles flowing along the arrow.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 141 · در حال پردازش · `processing.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body wearing a tiny chef-like cap-free cheerful face turning a small gear and a spoon over a bubbling pot with sparkles (cooking the result).

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-b-roles"></a>

### نقش‌ها و ارتباط‌ها (10)

#### ⬜ 142 · مشتری · `role_client.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, stylish and excited, holding a smartphone showing a heart and a shopping-bag-free calendar, a small sparkling tote bag; no apron colour change but a light scarf.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 143 · آرتیست · `role_artist.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brush and palette in hands, a beret-free cheerful expression, apron with colourful paint dots; sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 144 · سالن · `role_salon.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body standing proudly in front of a small cute shopfront with an awning in pink and white stripes and a heart sign; hands on hips.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 145 · دعوت‌نامه · `invite_received.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body opening a glowing envelope with a heart seal from which a paper note and sparkles rise; surprised delighted face.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 146 · دعوت فرستاده شد · `invite_sent.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body folding a paper plane with a heart on the wing and tossing it; a dotted flight trail with sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 147 · پیوستن به تیم · `team_join.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body shaking hands with a second smaller identical mascot silhouette-free partner (a second mascot in lighter palette), hearts above.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 148 · ترک تیم · `team_leave.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body, gentle goodbye wave with a small bag over the shoulder walking toward a door; soft smile, a tiny heart left behind.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 149 · اسکن QR · `qr_join.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding a phone toward a big abstract QR code (just a pattern of black and pink squares, no real code) with a scanning beam line and sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 150 · پیشنهاد همکاری · `collab_proposal.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding a rolled certificate-like scroll tied with a pink ribbon and extending it forward with both hands; hopeful smile.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 151 · سهم همکاری · `revenue_share.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body holding a pie chart divided into a pink and a gold slice, pointing at the slice with a stick; a small coin sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-b-reactions"></a>

### ری‌اکشن‌ها (ایموجی‌های چت/اعلان) (12)

#### ⬜ 152 · ممنون · `react_thanks.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, hands together at the chest, eyes closed, warm smile, small hearts.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 153 · اوکی · `react_ok.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, one hand making the OK circle sign next to its face, confident wink.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 154 · خنده اشکی · `react_laugh_tears.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, laughing with mouth wide, big blue tear drops flying from the eyes, holding its tummy.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 155 · تعجب · `react_surprised.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, huge eyes and tiny open mouth, both hands on cheeks, small impact lines around the head.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 156 · خواب‌آلود · `react_sleepy.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, half-closed eyes, a yawn, a tiny sleeping cap on the curl, wavy z-curls floating.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 157 · جشن · `react_party.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, mouth open in a cheer with a party hat, confetti raining.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 158 · عاشق · `react_love.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, heart-shaped eyes, hands holding a big heart, tiny hearts floating.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 159 · عالیه · `react_thumbs_up.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, big grin, strong thumbs-up, a star glint on the thumb.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 160 · فکر کردن · `react_thinking.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, hand on chin, looking up with a thinking bubble made of three growing circles and a sparkle.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 161 · خجالتی · `react_shy.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, big blush, covering half the face with both hands and peeking through fingers.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 162 · ناراحت · `react_sad.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, teary shiny eyes, wobbly mouth, one tear, a little rain cloud above the curl.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 163 · آتیش · `react_wow_fire.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head-and-shoulders, confident cool face with sunglasses, small flames of warm orange around the shoulders, sparkles.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

<a id="g-b-brand"></a>

### برند و صفحه‌های بزرگ (5)

#### ⬜ 164 · آیکن اپ · `brand_icon.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Head only, perfectly centered, larger, cheerful face with the heart-curl, brush behind the ear; a clean silhouette so it stays clear at 48px; no body.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 165 · هیرو صفحه اول · `brand_hero.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body, waving hello with a welcoming open smile, standing at the center, a few floating beauty props (scissors, lipstick, hair dryer, nail polish, mirror) drawn small orbiting around with sparkles. Square 1:1.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 166 · خوش‌آمدی · `brand_welcome.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body holding a small welcome banner-free sign shaped like a heart and a bouquet; bowing slightly with hearts around.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 167 · اسپلش · `brand_splash.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Full-body mid-jump with arms up and a trail of sparkles forming a circle, joyful closed-eye grin.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```

#### ⬜ 168 · تصویر پشت لودینگ برند · `brand_404_hair.png`

```text
Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.

Scene: Half-body, brush painting a pink heart in the air; the heart glows.

Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.

Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading.

Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.
```
