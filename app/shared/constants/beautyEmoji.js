// Beauty emoji pack — vector icons for services (generated from the designed
// preview pack). Each icon is a self-contained 128×128 SVG string; render it
// with <ServiceEmoji id="..."/> (app/components/ServiceEmoji.jsx), never via
// innerHTML. Services store only the icon `id` in their `emoji` column.

export const EMOJI_CATEGORIES = [
  {
    "id": "hair",
    "fa": "مو",
    "en": "Hair"
  },
  {
    "id": "makeup",
    "fa": "آرایش و تاتو",
    "en": "Makeup"
  },
  {
    "id": "brow_lash",
    "fa": "ابرو و مژه",
    "en": "Brows & lashes"
  },
  {
    "id": "nails",
    "fa": "ناخن",
    "en": "Nails"
  },
  {
    "id": "skin",
    "fa": "پوست",
    "en": "Skin"
  },
  {
    "id": "clinic",
    "fa": "کلینیک",
    "en": "Clinic"
  },
  {
    "id": "body",
    "fa": "بدن و اسپا",
    "en": "Body & spa"
  },
  {
    "id": "general",
    "fa": "عمومی",
    "en": "General"
  }
];

export const BEAUTY_EMOJIS = [
  {
    "id": "haircut",
    "fa": "کوتاهی مو",
    "en": "Haircut",
    "category": "hair",
    "tags": [
      "cut",
      "scissors",
      "کوتاهی",
      "قیچی"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M70 72 L36 14 Q31 13 32 20 L60 76Z\" fill=\"#D6D2E6\"/>\n<path d=\"M58 72 L92 14 Q97 13 96 20 L68 76Z\" fill=\"#9C96B5\"/>\n<path d=\"M52 86 L62 72\" stroke=\"#7C5CFA\" stroke-width=\"9\" stroke-linecap=\"round\"/>\n<path d=\"M76 86 L66 72\" stroke=\"#7C5CFA\" stroke-width=\"9\" stroke-linecap=\"round\"/>\n<circle cx=\"42\" cy=\"98\" r=\"15\" fill=\"none\" stroke=\"#7C5CFA\" stroke-width=\"9\"/>\n<circle cx=\"86\" cy=\"98\" r=\"15\" fill=\"none\" stroke=\"#7C5CFA\" stroke-width=\"9\"/>\n<circle cx=\"64\" cy=\"70\" r=\"5\" fill=\"#2E2A47\"/></svg>"
  },
  {
    "id": "hair_color",
    "fa": "رنگ مو",
    "en": "Hair color",
    "category": "hair",
    "tags": [
      "color",
      "dye",
      "رنگ"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M20 70 H108 Q104 108 64 110 Q24 108 20 70Z\" fill=\"#7C5CFA\"/>\n<ellipse cx=\"64\" cy=\"70\" rx=\"44\" ry=\"9\" fill=\"#5B3FD6\"/>\n<ellipse cx=\"64\" cy=\"70\" rx=\"38\" ry=\"6\" fill=\"#FF7EB3\"/>\n<g transform=\"rotate(35 80 50)\">\n<rect x=\"74\" y=\"8\" width=\"10\" height=\"46\" rx=\"5\" fill=\"#2E2A47\"/>\n<rect x=\"70\" y=\"50\" width=\"18\" height=\"14\" rx=\"3\" fill=\"#D6D2E6\"/>\n<rect x=\"70\" y=\"62\" width=\"18\" height=\"10\" rx=\"2\" fill=\"#E85A93\"/></g>\n<path d=\"M30 84 Q30 92 34 92\" stroke=\"#FFFFFF\" stroke-width=\"5\" fill=\"none\" stroke-linecap=\"round\" opacity=\".5\"/></svg>"
  },
  {
    "id": "highlights",
    "fa": "لایت و هایلایت",
    "en": "Highlights",
    "category": "hair",
    "tags": [
      "light",
      "highlight",
      "balayage",
      "لایت",
      "مش",
      "آمبره"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M38 18 C20 46 56 74 38 112\" stroke=\"#7A4A33\" stroke-width=\"15\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M54 18 C36 46 72 74 54 112\" stroke=\"#FFC24B\" stroke-width=\"15\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M70 18 C52 46 88 74 70 112\" stroke=\"#5A3323\" stroke-width=\"15\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M86 18 C68 46 104 74 86 112\" stroke=\"#FFC24B\" stroke-width=\"15\" fill=\"none\" stroke-linecap=\"round\"/>\n<rect x=\"24\" y=\"8\" width=\"80\" height=\"16\" rx=\"8\" fill=\"#7C5CFA\"/></svg>"
  },
  {
    "id": "blowdry",
    "fa": "براشینگ و سشوار",
    "en": "Blow-dry",
    "category": "hair",
    "tags": [
      "brushing",
      "dryer",
      "براشینگ",
      "سشوار"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M50 70 L64 70 L58 114 Q56 120 50 120 L44 120 Q38 120 39 114Z\" fill=\"#5B3FD6\"/>\n<circle cx=\"50\" cy=\"96\" r=\"4\" fill=\"#FF7EB3\"/>\n<path d=\"M50 26 H98 Q104 26 104 32 V64 Q104 70 98 70 H50Z\" fill=\"#7C5CFA\"/>\n<circle cx=\"48\" cy=\"48\" r=\"30\" fill=\"#7C5CFA\"/>\n<circle cx=\"48\" cy=\"48\" r=\"16\" fill=\"#5B3FD6\"/>\n<circle cx=\"48\" cy=\"48\" r=\"7\" fill=\"#EDE8FF\"/>\n<rect x=\"100\" y=\"30\" width=\"10\" height=\"36\" rx=\"4\" fill=\"#2E2A47\"/>\n<path d=\"M116 36 H124 M114 48 H126 M116 60 H124\" stroke=\"#5BC0F8\" stroke-width=\"5\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "updo",
    "fa": "شینیون",
    "en": "Updo",
    "category": "hair",
    "tags": [
      "updo",
      "bun",
      "bride",
      "شینیون",
      "جمع",
      "مو"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><circle cx=\"64\" cy=\"24\" r=\"16\" fill=\"#7A4A33\"/><circle cx=\"64\" cy=\"70\" r=\"40\" fill=\"#7A4A33\"/>\n<ellipse cx=\"64\" cy=\"72\" rx=\"30\" ry=\"34\" fill=\"#FFD3B5\"/>\n<path d=\"M34 68 Q36 36 64 36 Q92 36 94 68 Q84 50 64 52 Q44 50 34 68Z\" fill=\"#7A4A33\"/>\n<path d=\"M46 76 Q51 80 56 76\" stroke=\"#2E2A47\" stroke-width=\"3.5\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M72 76 Q77 80 82 76\" stroke=\"#2E2A47\" stroke-width=\"3.5\" fill=\"none\" stroke-linecap=\"round\"/>\n<circle cx=\"44\" cy=\"88\" r=\"5\" fill=\"#FF7EB3\" opacity=\".55\"/><circle cx=\"84\" cy=\"88\" r=\"5\" fill=\"#FF7EB3\" opacity=\".55\"/>\n<path d=\"M56 92 Q64 99 72 92\" stroke=\"#E23D55\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/>\n<circle cx=\"78\" cy=\"16\" r=\"6\" fill=\"#FF7EB3\"/><circle cx=\"78\" cy=\"16\" r=\"2.5\" fill=\"#FFC24B\"/></svg>"
  },
  {
    "id": "hair_styling",
    "fa": "حالت‌دهی و فر",
    "en": "Curls & styling",
    "category": "hair",
    "tags": [
      "curl",
      "wave",
      "فر",
      "موج",
      "حالت"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M40 14 C14 24 14 44 40 50 C66 56 66 76 40 82 C14 88 14 108 40 114\" stroke=\"#7A4A33\" stroke-width=\"14\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M88 14 C62 24 62 44 88 50 C114 56 114 76 88 82 C62 88 62 108 88 114\" stroke=\"#A86E4F\" stroke-width=\"14\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M106 12 Q108.8 19.2 116 22 Q108.8 24.8 106 32 Q103.2 24.8 96 22 Q103.2 19.2 106 12Z\" fill=\"#FFC24B\"/></svg>"
  },
  {
    "id": "keratin",
    "fa": "کراتین و احیا",
    "en": "Keratin & repair",
    "category": "hair",
    "tags": [
      "keratin",
      "botox",
      "protein",
      "کراتین",
      "بوتاکس",
      "مو",
      "پروتئین"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M64 12 C64 12 30 52 30 74 A34 34 0 0 0 98 74 C98 52 64 12 64 12Z\" fill=\"#FFC24B\"/><path d=\"M46 72 Q46 60 54 50\" stroke=\"#FFFFFF\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".6\"/>\n<path d=\"M64 64 Q67.92 74.08 78 78 Q67.92 81.92 64 92 Q60.08 81.92 50 78 Q60.08 74.08 64 64Z\" fill=\"#FFFFFF\"/>\n<path d=\"M104 16 Q106.8 23.2 114 26 Q106.8 28.8 104 36 Q101.2 28.8 94 26 Q101.2 23.2 104 16Z\" fill=\"#F0A020\"/><path d=\"M24 23 Q25.96 28.04 31 30 Q25.96 31.96 24 37 Q22.04 31.96 17 30 Q22.04 28.04 24 23Z\" fill=\"#F0A020\"/></svg>"
  },
  {
    "id": "hair_extension",
    "fa": "اکستنشن مو",
    "en": "Hair extensions",
    "category": "hair",
    "tags": [
      "extension",
      "اکستنشن"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M42 22 H86 Q92 70 72 112 Q64 120 56 112 Q36 70 42 22Z\" fill=\"#7A4A33\"/>\n<path d=\"M54 30 Q52 70 60 104 M70 30 Q74 70 68 104\" stroke=\"#A86E4F\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/>\n<rect x=\"36\" y=\"12\" width=\"56\" height=\"16\" rx=\"5\" fill=\"#9C96B5\"/>\n<path d=\"M44 28 V36 M54 28 V36 M64 28 V36 M74 28 V36 M84 28 V36\" stroke=\"#9C96B5\" stroke-width=\"4\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "braid",
    "fa": "بافت مو",
    "en": "Braids",
    "category": "hair",
    "tags": [
      "braid",
      "بافت"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><ellipse cx=\"56\" cy=\"20\" rx=\"16\" ry=\"10\" transform=\"rotate(-30 56 20)\" fill=\"#FFC24B\"/><ellipse cx=\"72\" cy=\"32\" rx=\"16\" ry=\"10\" transform=\"rotate(30 72 32)\" fill=\"#F0A020\"/><ellipse cx=\"56\" cy=\"44\" rx=\"16\" ry=\"10\" transform=\"rotate(-30 56 44)\" fill=\"#FFC24B\"/><ellipse cx=\"72\" cy=\"56\" rx=\"16\" ry=\"10\" transform=\"rotate(30 72 56)\" fill=\"#F0A020\"/><ellipse cx=\"56\" cy=\"68\" rx=\"16\" ry=\"10\" transform=\"rotate(-30 56 68)\" fill=\"#FFC24B\"/><ellipse cx=\"72\" cy=\"80\" rx=\"16\" ry=\"10\" transform=\"rotate(30 72 80)\" fill=\"#F0A020\"/><ellipse cx=\"56\" cy=\"92\" rx=\"16\" ry=\"10\" transform=\"rotate(-30 56 92)\" fill=\"#FFC24B\"/>\n<rect x=\"54\" y=\"98\" width=\"20\" height=\"9\" rx=\"4\" fill=\"#FF7EB3\"/>\n<path d=\"M56 106 L50 122 H78 L72 106Z\" fill=\"#FFC24B\"/></svg>"
  },
  {
    "id": "hair_wash",
    "fa": "شستشو و ماسک مو",
    "en": "Wash & hair mask",
    "category": "hair",
    "tags": [
      "wash",
      "shampoo",
      "mask",
      "شامپو",
      "شستشو",
      "ماسک"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"56\" y=\"18\" width=\"16\" height=\"12\" rx=\"2\" fill=\"#2E2A47\"/>\n<rect x=\"66\" y=\"18\" width=\"24\" height=\"7\" rx=\"3\" fill=\"#2E2A47\"/>\n<rect x=\"52\" y=\"28\" width=\"24\" height=\"18\" rx=\"3\" fill=\"#9C96B5\"/>\n<rect x=\"36\" y=\"44\" width=\"56\" height=\"72\" rx=\"16\" fill=\"#3CCFB4\"/>\n<rect x=\"46\" y=\"64\" width=\"36\" height=\"32\" rx=\"7\" fill=\"#FFFFFF\"/>\n<path d=\"M64 70 C64 70 56 80 56 84 A8 8 0 0 0 72 84 C72 80 64 70 64 70Z\" fill=\"#20A88F\"/>\n<circle cx=\"104\" cy=\"50\" r=\"9\" fill=\"none\" stroke=\"#5BC0F8\" stroke-width=\"4\"/>\n<circle cx=\"112\" cy=\"76\" r=\"5\" fill=\"none\" stroke=\"#5BC0F8\" stroke-width=\"3.5\"/>\n<circle cx=\"22\" cy=\"40\" r=\"6\" fill=\"none\" stroke=\"#5BC0F8\" stroke-width=\"3.5\"/></svg>"
  },
  {
    "id": "barber",
    "fa": "اصلاح آقایان",
    "en": "Barber",
    "category": "hair",
    "tags": [
      "barber",
      "beard",
      "men",
      "آقایان",
      "ریش",
      "سبیل"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M64 58 C56 44 34 42 24 56 C16 66 10 64 6 56 C6 74 24 84 40 78 C50 74 58 70 64 68 C70 70 78 74 88 78 C104 84 122 74 122 56 C118 64 112 66 104 56 C94 42 72 44 64 58Z\" fill=\"#2E2A47\"/>\n<path d=\"M24 60 Q30 52 40 54\" stroke=\"#9C96B5\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\" opacity=\".7\"/></svg>"
  },
  {
    "id": "comb",
    "fa": "سشوار و حالت ساده",
    "en": "Comb",
    "category": "hair",
    "tags": [
      "comb",
      "شانه"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><g transform=\"rotate(-20 64 64)\">\n<rect x=\"14\" y=\"40\" width=\"100\" height=\"22\" rx=\"8\" fill=\"#FF7EB3\"/>\n<rect x=\"20\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"29\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"38\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"47\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"56\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"65\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"74\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"83\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"92\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/><rect x=\"101\" y=\"56\" width=\"5\" height=\"32\" rx=\"2.5\" fill=\"#FF7EB3\"/>\n<rect x=\"22\" y=\"46\" width=\"40\" height=\"5\" rx=\"2.5\" fill=\"#FFFFFF\" opacity=\".5\"/></g></svg>"
  },
  {
    "id": "lipstick",
    "fa": "آرایش و میکاپ",
    "en": "Makeup",
    "category": "makeup",
    "tags": [
      "makeup",
      "lipstick",
      "میکاپ",
      "آرایش",
      "رژ"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M50 48 V28 Q50 22 56 20 L78 12 V48Z\" fill=\"#FF5A6E\"/>\n<path d=\"M56 46 V30 Q56 26 60 25\" stroke=\"#FFFFFF\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\" opacity=\".5\"/>\n<rect x=\"46\" y=\"46\" width=\"36\" height=\"22\" rx=\"2\" fill=\"#FFC24B\"/>\n<rect x=\"40\" y=\"66\" width=\"48\" height=\"10\" rx=\"2\" fill=\"#F0A020\"/>\n<rect x=\"40\" y=\"74\" width=\"48\" height=\"44\" rx=\"5\" fill=\"#2E2A47\"/></svg>"
  },
  {
    "id": "bridal",
    "fa": "عروس",
    "en": "Bridal",
    "category": "makeup",
    "tags": [
      "bride",
      "wedding",
      "crown",
      "عروس",
      "تاج"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M16 94 L24 42 L45 66 L64 26 L83 66 L104 42 L112 94Z\" fill=\"#FFC24B\"/>\n<rect x=\"14\" y=\"88\" width=\"100\" height=\"18\" rx=\"5\" fill=\"#F0A020\"/>\n<circle cx=\"24\" cy=\"40\" r=\"7\" fill=\"#FF7EB3\"/><circle cx=\"104\" cy=\"40\" r=\"7\" fill=\"#FF7EB3\"/>\n<circle cx=\"64\" cy=\"24\" r=\"8\" fill=\"#FFFFFF\"/>\n<path d=\"M64 60 L74 72 L64 84 L54 72Z\" fill=\"#7C5CFA\"/>\n<circle cx=\"36\" cy=\"97\" r=\"4\" fill=\"#FFFFFF\"/><circle cx=\"64\" cy=\"97\" r=\"4\" fill=\"#FFFFFF\"/><circle cx=\"92\" cy=\"97\" r=\"4\" fill=\"#FFFFFF\"/></svg>"
  },
  {
    "id": "eyeshadow",
    "fa": "سایه و آرایش چشم",
    "en": "Eye makeup",
    "category": "makeup",
    "tags": [
      "eyeshadow",
      "palette",
      "سایه",
      "چشم"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"12\" y=\"28\" width=\"104\" height=\"72\" rx=\"14\" fill=\"#2E2A47\"/>\n<rect x=\"12\" y=\"28\" width=\"104\" height=\"8\" rx=\"4\" fill=\"#45405F\"/><circle cx=\"34\" cy=\"50\" r=\"11\" fill=\"#FF7EB3\"/><circle cx=\"64\" cy=\"50\" r=\"11\" fill=\"#7C5CFA\"/><circle cx=\"94\" cy=\"50\" r=\"11\" fill=\"#FFC24B\"/><circle cx=\"34\" cy=\"78\" r=\"11\" fill=\"#C88A6A\"/><circle cx=\"64\" cy=\"78\" r=\"11\" fill=\"#3CCFB4\"/><circle cx=\"94\" cy=\"78\" r=\"11\" fill=\"#F7A27A\"/></svg>"
  },
  {
    "id": "makeup_brush",
    "fa": "گریم و کانتور",
    "en": "Contour & brush",
    "category": "makeup",
    "tags": [
      "brush",
      "contour",
      "powder",
      "گریم",
      "براش",
      "کانتور"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><g transform=\"rotate(-40 64 64)\">\n<rect x=\"58\" y=\"66\" width=\"12\" height=\"54\" rx=\"6\" fill=\"#7C5CFA\"/>\n<rect x=\"55\" y=\"46\" width=\"18\" height=\"24\" rx=\"3\" fill=\"#D6D2E6\"/>\n<path d=\"M55 48 Q48 22 64 8 Q80 22 73 48Z\" fill=\"#E85A93\"/>\n<path d=\"M60 40 Q57 24 64 14\" stroke=\"#FFC2DA\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></g>\n<circle cx=\"98\" cy=\"96\" r=\"18\" fill=\"#F7C6A5\"/><circle cx=\"98\" cy=\"96\" r=\"11\" fill=\"#EBAA82\"/></svg>"
  },
  {
    "id": "lips",
    "fa": "لب",
    "en": "Lips",
    "category": "makeup",
    "tags": [
      "lips",
      "filler",
      "لب",
      "فیلر",
      "رژ"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M14 64 C30 42 50 40 64 52 C78 40 98 42 114 64 C96 62 80 62 64 66 C48 62 32 62 14 64Z\" fill=\"#FF5A6E\"/>\n<path d=\"M14 64 C32 68 48 68 64 70 C80 68 96 68 114 64 C100 92 80 98 64 98 C48 98 28 92 14 64Z\" fill=\"#E23D55\"/>\n<ellipse cx=\"74\" cy=\"82\" rx=\"12\" ry=\"4\" fill=\"#FFFFFF\" opacity=\".45\"/></svg>"
  },
  {
    "id": "tattoo",
    "fa": "تاتو و میکروبلیدینگ",
    "en": "PMU & microblading",
    "category": "makeup",
    "tags": [
      "tattoo",
      "pmu",
      "microblading",
      "تاتو",
      "میکروبلیدینگ",
      "هاشور"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><g transform=\"rotate(40 64 64)\">\n<rect x=\"54\" y=\"8\" width=\"20\" height=\"66\" rx=\"10\" fill=\"#7C5CFA\"/>\n<rect x=\"54\" y=\"20\" width=\"20\" height=\"6\" fill=\"#5B3FD6\"/>\n<rect x=\"56\" y=\"72\" width=\"16\" height=\"20\" rx=\"3\" fill=\"#2E2A47\"/>\n<path d=\"M58 92 H70 L64 114Z\" fill=\"#9C96B5\"/></g>\n<path d=\"M14 116 Q30 96 56 102\" stroke=\"#5A3323\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "eyebrow",
    "fa": "اصلاح و لیفت ابرو",
    "en": "Brows",
    "category": "brow_lash",
    "tags": [
      "brow",
      "eyebrow",
      "ابرو",
      "اصلاح",
      "لیفت"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M12 80 C28 52 70 38 114 54 C119 56 117 64 112 63 C78 56 46 64 22 86 C15 92 8 86 12 80Z\" fill=\"#5A3323\"/>\n<path d=\"M30 70 L36 62 M44 62 L50 54 M58 56 L64 49 M72 53 L79 47 M86 54 L94 49\" stroke=\"#A86E4F\" stroke-width=\"3\" stroke-linecap=\"round\"/>\n<path d=\"M98 80 Q101.36 88.64 110 92 Q101.36 95.36 98 104 Q94.64 95.36 86 92 Q94.64 88.64 98 80Z\" fill=\"#FFC24B\"/><path d=\"M76 98 Q77.68 102.32 82 104 Q77.68 105.68 76 110 Q74.32 105.68 70 104 Q74.32 102.32 76 98Z\" fill=\"#FF7EB3\"/></svg>"
  },
  {
    "id": "lash_ext",
    "fa": "اکستنشن مژه",
    "en": "Lash extensions",
    "category": "brow_lash",
    "tags": [
      "lash",
      "extension",
      "مژه",
      "اکستنشن"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M16 58 Q64 18 112 58 Q64 100 16 58Z\" fill=\"#FFC2DA\"/>\n<path d=\"M27.5 66.9 Q20.2 77.9 10.3 85.2\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M36.6 72.2 Q30.7 84.0 21.8 91.9\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M45.8 76.0 Q41.6 88.5 33.8 96.8\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M54.9 78.2 Q52.7 91.3 46.3 99.9\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M64.0 79.0 Q64.0 92.2 59.0 101.0\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M73.1 78.2 Q75.3 91.3 81.7 99.9\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M82.2 76.0 Q86.4 88.5 94.2 96.8\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M91.4 72.2 Q97.3 84.0 106.2 91.9\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M100.5 66.9 Q107.8 77.9 117.7 85.2\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M16 58 Q64 100 112 58\" stroke=\"#2E2A47\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "lash_lift",
    "fa": "لیفت مژه",
    "en": "Lash lift",
    "category": "brow_lash",
    "tags": [
      "lash",
      "lift",
      "مژه",
      "لیفت"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M26.0 61.4 Q18.7 51.9 8.9 45.5\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M35.5 55.1 Q29.6 44.7 20.6 37.7\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M45.0 50.6 Q40.7 39.4 32.9 31.9\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M54.5 47.9 Q52.3 36.1 45.8 28.3\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M64.0 47.0 Q64.0 35.0 59.0 27.0\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M73.5 47.9 Q75.7 36.1 82.2 28.3\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M83.0 50.6 Q87.3 39.4 95.1 31.9\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M92.5 55.1 Q98.4 44.7 107.4 37.7\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M102.0 61.4 Q109.3 51.9 119.1 45.5\" stroke=\"#2E2A47\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M14 72 Q64 22 114 72 Q64 114 14 72Z\" fill=\"#FFFFFF\" stroke=\"#2E2A47\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<circle cx=\"64\" cy=\"70\" r=\"20\" fill=\"#7C5CFA\"/>\n<circle cx=\"64\" cy=\"70\" r=\"9\" fill=\"#2E2A47\"/>\n<circle cx=\"71\" cy=\"63\" r=\"5\" fill=\"#FFFFFF\"/></svg>"
  },
  {
    "id": "manicure",
    "fa": "مانیکور",
    "en": "Manicure",
    "category": "nails",
    "tags": [
      "manicure",
      "polish",
      "مانیکور",
      "لاک"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"50\" y=\"10\" width=\"28\" height=\"42\" rx=\"6\" fill=\"#2E2A47\"/>\n<rect x=\"46\" y=\"50\" width=\"36\" height=\"9\" rx=\"2\" fill=\"#9C96B5\"/>\n<rect x=\"28\" y=\"56\" width=\"72\" height=\"60\" rx=\"20\" fill=\"#FF7EB3\"/>\n<rect x=\"40\" y=\"68\" width=\"10\" height=\"34\" rx=\"5\" fill=\"#FFFFFF\" opacity=\".5\"/></svg>"
  },
  {
    "id": "pedicure",
    "fa": "پدیکور",
    "en": "Pedicure",
    "category": "nails",
    "tags": [
      "pedicure",
      "foot",
      "پدیکور",
      "پا"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M42 50 C32 74 34 100 52 114 C70 124 90 112 90 94 C90 80 82 70 88 56 C94 40 50 32 42 50Z\" fill=\"#FFD3B5\"/>\n<path d=\"M50 60 C44 80 48 98 58 106\" stroke=\"#F2B48F\" stroke-width=\"5\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"44\" cy=\"30\" r=\"10\" fill=\"#FFD3B5\"/><circle cx=\"44\" cy=\"27.5\" r=\"5.5\" fill=\"#FF7EB3\"/><circle cx=\"62\" cy=\"22\" r=\"8.5\" fill=\"#FFD3B5\"/><circle cx=\"62\" cy=\"19.9\" r=\"4.7\" fill=\"#FF7EB3\"/><circle cx=\"77\" cy=\"22\" r=\"7.5\" fill=\"#FFD3B5\"/><circle cx=\"77\" cy=\"20.1\" r=\"4.1\" fill=\"#FF7EB3\"/><circle cx=\"90\" cy=\"28\" r=\"6.5\" fill=\"#FFD3B5\"/><circle cx=\"90\" cy=\"26.4\" r=\"3.6\" fill=\"#FF7EB3\"/><circle cx=\"100\" cy=\"39\" r=\"5.5\" fill=\"#FFD3B5\"/><circle cx=\"100\" cy=\"37.6\" r=\"3.0\" fill=\"#FF7EB3\"/></svg>"
  },
  {
    "id": "nail_art",
    "fa": "طراحی ناخن",
    "en": "Nail art",
    "category": "nails",
    "tags": [
      "nail",
      "art",
      "design",
      "طراحی",
      "ناخن"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"34\" y=\"26\" width=\"60\" height=\"120\" rx=\"30\" fill=\"#FFD3B5\"/>\n<rect x=\"44\" y=\"34\" width=\"40\" height=\"54\" rx=\"20\" fill=\"#7C5CFA\"/>\n<path d=\"M64 52 C60 46 52 48 54 55 C55 60 64 66 64 66 C64 66 73 60 74 55 C76 48 68 46 64 52Z\" fill=\"#FFC2DA\"/>\n<circle cx=\"54\" cy=\"76\" r=\"3\" fill=\"#FFC24B\"/><circle cx=\"64\" cy=\"80\" r=\"3\" fill=\"#FFC24B\"/><circle cx=\"74\" cy=\"76\" r=\"3\" fill=\"#FFC24B\"/>\n<path d=\"M50 40 Q56 36 62 38\" stroke=\"#FFFFFF\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\" opacity=\".6\"/>\n<path d=\"M104 19 Q107.08 26.92 115 30 Q107.08 33.08 104 41 Q100.92 33.08 93 30 Q100.92 26.92 104 19Z\" fill=\"#FFC24B\"/></svg>"
  },
  {
    "id": "gel_nails",
    "fa": "کاشت و ژلیش",
    "en": "Gel & acrylic",
    "category": "nails",
    "tags": [
      "gel",
      "acrylic",
      "uv",
      "ژلیش",
      "کاشت"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M12 104 V76 Q12 32 64 32 Q116 32 116 76 V104Z\" fill=\"#F4F1FF\" stroke=\"#7C5CFA\" stroke-width=\"5\"/>\n<path d=\"M32 104 V84 Q32 58 64 58 Q96 58 96 84 V104Z\" fill=\"#5B3FD6\"/>\n<path d=\"M44 66 L50 78 M64 62 V76 M84 66 L78 78\" stroke=\"#B9A7FF\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n<rect x=\"6\" y=\"100\" width=\"116\" height=\"14\" rx=\"7\" fill=\"#7C5CFA\"/>\n<circle cx=\"52\" cy=\"46\" r=\"4\" fill=\"#3CCFB4\"/><circle cx=\"64\" cy=\"44\" r=\"4\" fill=\"#D6D2E6\"/><circle cx=\"76\" cy=\"46\" r=\"4\" fill=\"#D6D2E6\"/></svg>"
  },
  {
    "id": "facial",
    "fa": "فیشیال و پاکسازی",
    "en": "Facial",
    "category": "skin",
    "tags": [
      "facial",
      "mask",
      "cleansing",
      "فیشیال",
      "پاکسازی",
      "ماسک"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><ellipse cx=\"64\" cy=\"66\" rx=\"40\" ry=\"50\" fill=\"#A8E6CF\"/>\n<path d=\"M24 50 Q26 14 64 14 Q102 14 104 50 Q84 36 64 36 Q44 36 24 50Z\" fill=\"#FF7EB3\"/>\n<path d=\"M30 40 Q64 22 98 40\" stroke=\"#FFC2DA\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/>\n<circle cx=\"46\" cy=\"60\" r=\"14\" fill=\"#4CAF63\"/><circle cx=\"46\" cy=\"60\" r=\"11\" fill=\"#D9F7C9\"/><circle cx=\"42\" cy=\"57\" r=\"1.8\" fill=\"#7BD389\"/><circle cx=\"50\" cy=\"58\" r=\"1.8\" fill=\"#7BD389\"/><circle cx=\"46\" cy=\"64\" r=\"1.8\" fill=\"#7BD389\"/><circle cx=\"82\" cy=\"60\" r=\"14\" fill=\"#4CAF63\"/><circle cx=\"82\" cy=\"60\" r=\"11\" fill=\"#D9F7C9\"/><circle cx=\"78\" cy=\"57\" r=\"1.8\" fill=\"#7BD389\"/><circle cx=\"86\" cy=\"58\" r=\"1.8\" fill=\"#7BD389\"/><circle cx=\"82\" cy=\"64\" r=\"1.8\" fill=\"#7BD389\"/>\n<path d=\"M52 92 Q64 102 76 92\" stroke=\"#2E2A47\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "skincare",
    "fa": "مراقبت پوست",
    "en": "Skincare",
    "category": "skin",
    "tags": [
      "skincare",
      "cream",
      "مراقبت",
      "پوست",
      "کرم"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"22\" y=\"58\" width=\"84\" height=\"54\" rx=\"12\" fill=\"#FF7EB3\"/>\n<rect x=\"16\" y=\"38\" width=\"96\" height=\"26\" rx=\"9\" fill=\"#7C5CFA\"/>\n<rect x=\"24\" y=\"44\" width=\"40\" height=\"5\" rx=\"2.5\" fill=\"#FFFFFF\" opacity=\".4\"/>\n<rect x=\"40\" y=\"74\" width=\"48\" height=\"24\" rx=\"6\" fill=\"#FFFFFF\"/>\n<path d=\"M56 86 Q64 78 72 86\" stroke=\"#E85A93\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M108 11 Q111.08 18.92 119 22 Q111.08 25.08 108 33 Q104.92 25.08 97 22 Q104.92 18.92 108 11Z\" fill=\"#FFC24B\"/><path d=\"M22 15 Q23.96 20.04 29 22 Q23.96 23.96 22 29 Q20.04 23.96 15 22 Q20.04 20.04 22 15Z\" fill=\"#FFC24B\"/></svg>"
  },
  {
    "id": "serum",
    "fa": "سرم و مزوتراپی",
    "en": "Serum",
    "category": "skin",
    "tags": [
      "serum",
      "dropper",
      "meso",
      "سرم",
      "مزوتراپی"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"52\" y=\"8\" width=\"24\" height=\"30\" rx=\"12\" fill=\"#2E2A47\"/>\n<rect x=\"46\" y=\"34\" width=\"36\" height=\"22\" rx=\"4\" fill=\"#9C96B5\"/>\n<rect x=\"34\" y=\"54\" width=\"60\" height=\"62\" rx=\"14\" fill=\"#FFC24B\"/>\n<rect x=\"34\" y=\"78\" width=\"60\" height=\"38\" rx=\"14\" fill=\"#F0A020\"/>\n<rect x=\"44\" y=\"62\" width=\"9\" height=\"40\" rx=\"4.5\" fill=\"#FFFFFF\" opacity=\".5\"/>\n<path d=\"M64 84 C64 84 57 93 57 97 A7 7 0 0 0 71 97 C71 93 64 84 64 84Z\" fill=\"#FFFFFF\"/></svg>"
  },
  {
    "id": "hydrafacial",
    "fa": "هیدرافیشیال و آبرسانی",
    "en": "Hydrafacial",
    "category": "skin",
    "tags": [
      "hydrafacial",
      "hydration",
      "water",
      "هیدرافیشیال",
      "آبرسانی"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M64 12 C64 12 30 52 30 74 A34 34 0 0 0 98 74 C98 52 64 12 64 12Z\" fill=\"#5BC0F8\"/><path d=\"M46 72 Q46 60 54 50\" stroke=\"#FFFFFF\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".6\"/>\n<circle cx=\"72\" cy=\"82\" r=\"8\" fill=\"#FFFFFF\" opacity=\".35\"/>\n<circle cx=\"56\" cy=\"94\" r=\"5\" fill=\"#FFFFFF\" opacity=\".35\"/>\n<path d=\"M106 19 Q109.08 26.92 117 30 Q109.08 33.08 106 41 Q102.92 33.08 95 30 Q102.92 26.92 106 19Z\" fill=\"#2F9BE0\"/><path d=\"M22 29 Q23.96 34.04 29 36 Q23.96 37.96 22 43 Q20.04 37.96 15 36 Q20.04 34.04 22 29Z\" fill=\"#2F9BE0\"/></svg>"
  },
  {
    "id": "peeling",
    "fa": "لایه‌برداری",
    "en": "Peeling",
    "category": "skin",
    "tags": [
      "peel",
      "chemical",
      "لایه‌برداری",
      "پیلینگ"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M50 16 H78 V46 L108 102 Q112 116 98 116 H30 Q16 116 20 102 L50 46Z\" fill=\"#EDE8FF\" stroke=\"#5B3FD6\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M37 76 H91 L106 103 Q109 112 98 112 H30 Q19 112 22 103Z\" fill=\"#FF7EB3\"/>\n<rect x=\"42\" y=\"10\" width=\"44\" height=\"10\" rx=\"5\" fill=\"#5B3FD6\"/>\n<circle cx=\"52\" cy=\"96\" r=\"5\" fill=\"#FFFFFF\" opacity=\".7\"/><circle cx=\"70\" cy=\"88\" r=\"3.5\" fill=\"#FFFFFF\" opacity=\".7\"/><circle cx=\"80\" cy=\"100\" r=\"4\" fill=\"#FFFFFF\" opacity=\".7\"/>\n<circle cx=\"64\" cy=\"60\" r=\"3\" fill=\"#FF7EB3\"/><circle cx=\"58\" cy=\"36\" r=\"2.5\" fill=\"#FF7EB3\"/></svg>"
  },
  {
    "id": "injection",
    "fa": "بوتاکس و تزریقات",
    "en": "Botox & fillers",
    "category": "clinic",
    "tags": [
      "botox",
      "filler",
      "injection",
      "بوتاکس",
      "فیلر",
      "تزریق",
      "ژل"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><g transform=\"rotate(45 64 64)\">\n<rect x=\"58\" y=\"4\" width=\"12\" height=\"28\" rx=\"3\" fill=\"#9C96B5\"/>\n<rect x=\"46\" y=\"2\" width=\"36\" height=\"9\" rx=\"4\" fill=\"#2E2A47\"/>\n<rect x=\"42\" y=\"28\" width=\"44\" height=\"7\" rx=\"3.5\" fill=\"#2E2A47\"/>\n<rect x=\"50\" y=\"32\" width=\"28\" height=\"58\" rx=\"5\" fill=\"#EDE8FF\" stroke=\"#5B3FD6\" stroke-width=\"4\"/>\n<rect x=\"54\" y=\"58\" width=\"20\" height=\"28\" rx=\"2\" fill=\"#FF7EB3\"/><rect x=\"56\" y=\"40\" width=\"8\" height=\"3\" rx=\"1.5\" fill=\"#5B3FD6\"/><rect x=\"56\" y=\"50\" width=\"8\" height=\"3\" rx=\"1.5\" fill=\"#5B3FD6\"/><rect x=\"56\" y=\"60\" width=\"8\" height=\"3\" rx=\"1.5\" fill=\"#5B3FD6\"/><rect x=\"56\" y=\"70\" width=\"8\" height=\"3\" rx=\"1.5\" fill=\"#5B3FD6\"/>\n<rect x=\"58\" y=\"90\" width=\"12\" height=\"9\" rx=\"2\" fill=\"#9C96B5\"/>\n<rect x=\"62.5\" y=\"98\" width=\"3\" height=\"28\" rx=\"1.5\" fill=\"#9C96B5\"/></g></svg>"
  },
  {
    "id": "laser",
    "fa": "لیزر",
    "en": "Laser",
    "category": "clinic",
    "tags": [
      "laser",
      "hair",
      "removal",
      "لیزر",
      "موهای",
      "زائد"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"46\" y=\"6\" width=\"36\" height=\"62\" rx=\"14\" fill=\"#7C5CFA\"/>\n<circle cx=\"64\" cy=\"26\" r=\"6\" fill=\"#FFFFFF\"/>\n<rect x=\"58\" y=\"40\" width=\"12\" height=\"18\" rx=\"3\" fill=\"#5B3FD6\"/>\n<rect x=\"48\" y=\"64\" width=\"32\" height=\"16\" rx=\"4\" fill=\"#2E2A47\"/>\n<rect x=\"56\" y=\"80\" width=\"16\" height=\"6\" rx=\"2\" fill=\"#FF5A6E\"/>\n<rect x=\"57\" y=\"86\" width=\"14\" height=\"24\" fill=\"#FF5A6E\" opacity=\".25\"/>\n<rect x=\"61\" y=\"86\" width=\"6\" height=\"24\" fill=\"#FF5A6E\"/>\n<path d=\"M64 102 Q67.36 110.64 76 114 Q67.36 117.36 64 126 Q60.64 117.36 52 114 Q60.64 110.64 64 102Z\" fill=\"#FFC24B\"/>\n<path d=\"M38 112 H46 M82 112 H90 M44 98 L49 102 M84 98 L79 102\" stroke=\"#F0A020\" stroke-width=\"4\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "teeth",
    "fa": "بلیچینگ و لمینت",
    "en": "Teeth whitening",
    "category": "clinic",
    "tags": [
      "teeth",
      "whitening",
      "laminate",
      "bleaching",
      "بلیچینگ",
      "لمینت",
      "دندان"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M36 24 C24 24 18 36 20 50 C22 64 30 70 32 84 C34 100 38 116 46 116 C54 116 54 92 64 92 C74 92 74 116 82 116 C90 116 94 100 96 84 C98 70 106 64 108 50 C110 36 104 24 92 24 C80 24 74 30 64 30 C54 30 48 24 36 24Z\" fill=\"#FFFFFF\" stroke=\"#5BC0F8\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M32 44 Q34 34 44 34\" stroke=\"#5BC0F8\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\" opacity=\".6\"/>\n<path d=\"M108 6 Q111.36 14.64 120 18 Q111.36 21.36 108 30 Q104.64 21.36 96 18 Q104.64 14.64 108 6Z\" fill=\"#FFC24B\"/><path d=\"M88 47 Q89.96 52.04 95 54 Q89.96 55.96 88 61 Q86.04 55.96 81 54 Q86.04 52.04 88 47Z\" fill=\"#FFC24B\"/></svg>"
  },
  {
    "id": "waxing",
    "fa": "اپیلاسیون و وکس",
    "en": "Waxing",
    "category": "body",
    "tags": [
      "wax",
      "epilation",
      "اپیلاسیون",
      "وکس",
      "موم"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><g transform=\"rotate(25 64 64)\">\n<rect x=\"74\" y=\"4\" width=\"14\" height=\"64\" rx=\"7\" fill=\"#D9A066\"/>\n<rect x=\"77\" y=\"10\" width=\"4\" height=\"40\" rx=\"2\" fill=\"#F0C890\"/></g>\n<rect x=\"20\" y=\"56\" width=\"88\" height=\"56\" rx=\"14\" fill=\"#7C5CFA\"/>\n<ellipse cx=\"64\" cy=\"58\" rx=\"44\" ry=\"10\" fill=\"#5B3FD6\"/>\n<ellipse cx=\"64\" cy=\"58\" rx=\"38\" ry=\"7\" fill=\"#FFC24B\"/>\n<path d=\"M36 60 V76 A5 5 0 0 0 46 76 V62Z\" fill=\"#FFC24B\"/>\n<path d=\"M88 62 V70 A4 4 0 0 0 96 70 V61Z\" fill=\"#FFC24B\"/></svg>"
  },
  {
    "id": "massage",
    "fa": "ماساژ",
    "en": "Massage",
    "category": "body",
    "tags": [
      "massage",
      "stone",
      "ماساژ",
      "سنگ"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><ellipse cx=\"64\" cy=\"104\" rx=\"46\" ry=\"13\" fill=\"#4A4560\"/>\n<ellipse cx=\"64\" cy=\"84\" rx=\"38\" ry=\"12\" fill=\"#5E5878\"/>\n<ellipse cx=\"64\" cy=\"65\" rx=\"30\" ry=\"11\" fill=\"#736C8F\"/>\n<ellipse cx=\"64\" cy=\"48\" rx=\"21\" ry=\"9\" fill=\"#8A83A6\"/>\n<path d=\"M64 40 C60 22 74 10 92 12 C94 30 80 40 64 40Z\" fill=\"#7BD389\"/>\n<path d=\"M66 38 Q76 26 88 16\" stroke=\"#4CAF63\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "spa",
    "fa": "اسپا",
    "en": "Spa",
    "category": "body",
    "tags": [
      "spa",
      "lotus",
      "relax",
      "اسپا"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><g transform=\"translate(64 100) scale(.82) translate(-64 -100)\"><path d=\"M64 26 C48 50 48 82 64 100 C80 82 80 50 64 26Z\" fill=\"#FFC2DA\" transform=\"rotate(-62 64 100)\"/><path d=\"M64 26 C48 50 48 82 64 100 C80 82 80 50 64 26Z\" fill=\"#FFC2DA\" transform=\"rotate(62 64 100)\"/><path d=\"M64 26 C48 50 48 82 64 100 C80 82 80 50 64 26Z\" fill=\"#FFA3C8\" transform=\"rotate(-31 64 100)\"/><path d=\"M64 26 C48 50 48 82 64 100 C80 82 80 50 64 26Z\" fill=\"#FFA3C8\" transform=\"rotate(31 64 100)\"/><path d=\"M64 26 C48 50 48 82 64 100 C80 82 80 50 64 26Z\" fill=\"#FF7EB3\" transform=\"rotate(0 64 100)\"/></g>\n<path d=\"M14 110 Q26 102 38 110 Q50 118 62 110 Q74 102 86 110 Q98 118 114 110\" stroke=\"#5BC0F8\" stroke-width=\"5\" fill=\"none\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "aroma",
    "fa": "آروماتراپی",
    "en": "Aromatherapy",
    "category": "body",
    "tags": [
      "aroma",
      "candle",
      "آروماتراپی",
      "شمع"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><circle cx=\"64\" cy=\"38\" r=\"26\" fill=\"#FFC24B\" opacity=\".18\"/>\n<path d=\"M64 14 C64 14 50 30 50 40 A14 14 0 0 0 78 40 C78 30 64 14 64 14Z\" fill=\"#FFC24B\"/>\n<path d=\"M64 28 C64 28 58 36 58 42 A6 6 0 0 0 70 42 C70 36 64 28 64 28Z\" fill=\"#FF8A3D\"/>\n<rect x=\"62\" y=\"50\" width=\"4\" height=\"10\" fill=\"#2E2A47\"/>\n<rect x=\"40\" y=\"58\" width=\"48\" height=\"58\" rx=\"8\" fill=\"#FCE3C8\"/>\n<path d=\"M40 66 H88 V72 Q84 82 80 72 Q76 66 72 72 V80 Q68 86 64 80 V72 Q58 66 52 72 Q48 78 44 72 Q42 70 40 70Z\" fill=\"#FFF3E6\"/>\n<rect x=\"34\" y=\"110\" width=\"60\" height=\"8\" rx=\"4\" fill=\"#7C5CFA\"/></svg>"
  },
  {
    "id": "tanning",
    "fa": "برنزه",
    "en": "Tanning",
    "category": "body",
    "tags": [
      "tan",
      "sun",
      "برنزه",
      "سولاریوم"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(0 64 64)\"/><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(45 64 64)\"/><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(90 64 64)\"/><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(135 64 64)\"/><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(180 64 64)\"/><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(225 64 64)\"/><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(270 64 64)\"/><rect x=\"61\" y=\"6\" width=\"6\" height=\"16\" rx=\"3\" fill=\"#F0A020\" transform=\"rotate(315 64 64)\"/>\n<circle cx=\"64\" cy=\"64\" r=\"30\" fill=\"#FFC24B\"/>\n<path d=\"M50 60 Q54 56 58 60 M70 60 Q74 56 78 60\" stroke=\"#2E2A47\" stroke-width=\"3.5\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M54 72 Q64 80 74 72\" stroke=\"#2E2A47\" stroke-width=\"3.5\" fill=\"none\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "body_contour",
    "fa": "لاغری و فرم‌دهی",
    "en": "Body contouring",
    "category": "body",
    "tags": [
      "slimming",
      "body",
      "tape",
      "لاغری",
      "فرم",
      "دهی"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"50\" y=\"76\" width=\"70\" height=\"20\" rx=\"3\" fill=\"#FFC24B\"/><rect x=\"58\" y=\"80\" width=\"2.5\" height=\"8\" fill=\"#2E2A47\"/><rect x=\"66\" y=\"80\" width=\"2.5\" height=\"5\" fill=\"#2E2A47\"/><rect x=\"74\" y=\"80\" width=\"2.5\" height=\"8\" fill=\"#2E2A47\"/><rect x=\"82\" y=\"80\" width=\"2.5\" height=\"5\" fill=\"#2E2A47\"/><rect x=\"90\" y=\"80\" width=\"2.5\" height=\"8\" fill=\"#2E2A47\"/><rect x=\"98\" y=\"80\" width=\"2.5\" height=\"5\" fill=\"#2E2A47\"/><rect x=\"106\" y=\"80\" width=\"2.5\" height=\"8\" fill=\"#2E2A47\"/><rect x=\"114\" y=\"80\" width=\"2.5\" height=\"5\" fill=\"#2E2A47\"/>\n<circle cx=\"46\" cy=\"62\" r=\"36\" fill=\"#FF7EB3\"/>\n<circle cx=\"46\" cy=\"62\" r=\"24\" fill=\"#E85A93\"/>\n<circle cx=\"46\" cy=\"62\" r=\"10\" fill=\"#FFC2DA\"/>\n<rect x=\"70\" y=\"40\" width=\"10\" height=\"16\" rx=\"3\" fill=\"#2E2A47\"/></svg>"
  },
  {
    "id": "perfume",
    "fa": "عطر",
    "en": "Fragrance",
    "category": "body",
    "tags": [
      "perfume",
      "fragrance",
      "عطر"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"48\" y=\"20\" width=\"32\" height=\"22\" rx=\"5\" fill=\"#FFC24B\"/>\n<rect x=\"56\" y=\"40\" width=\"16\" height=\"14\" fill=\"#9C96B5\"/>\n<rect x=\"28\" y=\"52\" width=\"72\" height=\"64\" rx=\"18\" fill=\"#C9BBFF\"/>\n<path d=\"M28 82 H100 V98 Q100 116 82 116 H46 Q28 116 28 98Z\" fill=\"#7C5CFA\"/>\n<rect x=\"38\" y=\"60\" width=\"9\" height=\"30\" rx=\"4.5\" fill=\"#FFFFFF\" opacity=\".5\"/>\n<circle cx=\"30\" cy=\"30\" r=\"3\" fill=\"#FF7EB3\"/><circle cx=\"20\" cy=\"22\" r=\"3\" fill=\"#FF7EB3\"/><circle cx=\"22\" cy=\"36\" r=\"3\" fill=\"#FF7EB3\"/><circle cx=\"12\" cy=\"30\" r=\"3\" fill=\"#FF7EB3\"/></svg>"
  },
  {
    "id": "rejuvenation",
    "fa": "جوانسازی",
    "en": "Rejuvenation",
    "category": "general",
    "tags": [
      "glow",
      "rejuvenation",
      "جوانسازی"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M24 74 Q24 28 64 28 Q104 28 104 74 V116 H24Z\" fill=\"#7A4A33\"/>\n<ellipse cx=\"64\" cy=\"72\" rx=\"30\" ry=\"34\" fill=\"#FFD3B5\"/>\n<path d=\"M34 68 Q36 36 64 36 Q92 36 94 68 Q84 50 64 52 Q44 50 34 68Z\" fill=\"#7A4A33\"/>\n<path d=\"M46 76 Q51 80 56 76\" stroke=\"#2E2A47\" stroke-width=\"3.5\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M72 76 Q77 80 82 76\" stroke=\"#2E2A47\" stroke-width=\"3.5\" fill=\"none\" stroke-linecap=\"round\"/>\n<circle cx=\"44\" cy=\"88\" r=\"5\" fill=\"#FF7EB3\" opacity=\".55\"/><circle cx=\"84\" cy=\"88\" r=\"5\" fill=\"#FF7EB3\" opacity=\".55\"/>\n<path d=\"M56 92 Q64 99 72 92\" stroke=\"#E23D55\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M106 14 Q109.36 22.64 118 26 Q109.36 29.36 106 38 Q102.64 29.36 94 26 Q102.64 22.64 106 14Z\" fill=\"#FFC24B\"/><path d=\"M20 22 Q22.240000000000002 27.759999999999998 28 30 Q22.240000000000002 32.24 20 38 Q17.759999999999998 32.24 12 30 Q17.759999999999998 27.759999999999998 20 22Z\" fill=\"#FFC24B\"/><path d=\"M108 97 Q109.96 102.04 115 104 Q109.96 105.96 108 111 Q106.04 105.96 101 104 Q106.04 102.04 108 97Z\" fill=\"#FF7EB3\"/></svg>"
  },
  {
    "id": "mirror",
    "fa": "مشاوره چهره",
    "en": "Beauty check",
    "category": "general",
    "tags": [
      "mirror",
      "آینه"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"57\" y=\"80\" width=\"14\" height=\"42\" rx=\"7\" fill=\"#E85A93\"/>\n<circle cx=\"64\" cy=\"50\" r=\"40\" fill=\"#FF7EB3\"/>\n<circle cx=\"64\" cy=\"50\" r=\"31\" fill=\"#DDF3FF\"/>\n<path d=\"M46 40 L58 28 M46 54 L70 30\" stroke=\"#FFFFFF\" stroke-width=\"5\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "consult",
    "fa": "مشاوره",
    "en": "Consultation",
    "category": "general",
    "tags": [
      "consult",
      "chat",
      "مشاوره"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M24 20 H104 Q116 20 116 32 V76 Q116 88 104 88 H58 L36 110 V88 H24 Q12 88 12 76 V32 Q12 20 24 20Z\" fill=\"#7C5CFA\"/>\n<circle cx=\"42\" cy=\"54\" r=\"7\" fill=\"#FFFFFF\"/><circle cx=\"64\" cy=\"54\" r=\"7\" fill=\"#FFFFFF\"/><circle cx=\"86\" cy=\"54\" r=\"7\" fill=\"#FFFFFF\"/></svg>"
  },
  {
    "id": "gift",
    "fa": "پکیج و کارت هدیه",
    "en": "Package & gift",
    "category": "general",
    "tags": [
      "gift",
      "package",
      "voucher",
      "پکیج",
      "هدیه"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect x=\"22\" y=\"58\" width=\"84\" height=\"56\" rx=\"6\" fill=\"#FF7EB3\"/>\n<rect x=\"16\" y=\"44\" width=\"96\" height=\"20\" rx=\"5\" fill=\"#E85A93\"/>\n<rect x=\"58\" y=\"44\" width=\"12\" height=\"70\" fill=\"#FFC24B\"/>\n<path d=\"M64 44 C50 20 26 26 36 40 C42 48 58 46 64 44Z\" fill=\"#FFC24B\"/>\n<path d=\"M64 44 C78 20 102 26 92 40 C86 48 70 46 64 44Z\" fill=\"#F0A020\"/>\n<circle cx=\"64\" cy=\"44\" r=\"6\" fill=\"#F0A020\"/></svg>"
  },
  {
    "id": "vip",
    "fa": "ویژه / VIP",
    "en": "VIP",
    "category": "general",
    "tags": [
      "vip",
      "star",
      "ویژه",
      "ستاره"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><polygon points=\"64.0,14.0 76.9,48.2 113.5,49.9 84.9,72.8 94.6,108.1 64.0,88.0 33.4,108.1 43.1,72.8 14.5,49.9 51.1,48.2\" fill=\"#FFC24B\" stroke=\"#FFC24B\" stroke-width=\"6\" stroke-linejoin=\"round\"/></svg>"
  },
  {
    "id": "sparkles",
    "fa": "درخشش",
    "en": "Glow",
    "category": "general",
    "tags": [
      "sparkle",
      "glow",
      "درخشش"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M54 26 Q65.2 54.8 94 66 Q65.2 77.2 54 106 Q42.8 77.2 14 66 Q42.8 54.8 54 26Z\" fill=\"#FFC24B\"/><path d=\"M100 10 Q105.04 22.96 118 28 Q105.04 33.04 100 46 Q94.96 33.04 82 28 Q94.96 22.96 100 10Z\" fill=\"#FF7EB3\"/><path d=\"M102 86 Q105.36 94.64 114 98 Q105.36 101.36 102 110 Q98.64 101.36 90 98 Q98.64 94.64 102 86Z\" fill=\"#7C5CFA\"/></svg>"
  },
  {
    "id": "heart",
    "fa": "محبوب",
    "en": "Favorite",
    "category": "general",
    "tags": [
      "heart",
      "love",
      "محبوب",
      "قلب"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M64 110 C64 110 14 80 14 46 C14 28 28 16 44 16 C54 16 60 22 64 30 C68 22 74 16 84 16 C100 16 114 28 114 46 C114 80 64 110 64 110Z\" fill=\"#FF5A6E\"/>\n<path d=\"M30 44 Q30 30 44 30\" stroke=\"#FFFFFF\" stroke-width=\"6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".5\"/></svg>"
  },
  {
    "id": "rose",
    "fa": "گل",
    "en": "Flower",
    "category": "general",
    "tags": [
      "flower",
      "rose",
      "گل"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M64 66 Q60 96 64 122\" stroke=\"#4CAF63\" stroke-width=\"6\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M62 96 C44 98 34 86 34 78 C48 76 60 84 62 96Z\" fill=\"#7BD389\"/>\n<path d=\"M66 106 C82 108 92 98 94 90 C80 86 68 94 66 106Z\" fill=\"#7BD389\"/>\n<circle cx=\"64\" cy=\"42\" r=\"30\" fill=\"#FF5A6E\"/>\n<path d=\"M64 42 m-6 0 a6 6 0 1 1 12 0 a12 12 0 1 1 -24 0 a18 18 0 1 1 36 0\" stroke=\"#E23D55\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/></svg>"
  },
  {
    "id": "gem",
    "fa": "جواهر و پیرسینگ",
    "en": "Piercing & jewel",
    "category": "general",
    "tags": [
      "gem",
      "piercing",
      "جواهر",
      "پیرسینگ"
    ],
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><path d=\"M36 22 H92 L116 48 L64 112 L12 48Z\" fill=\"#5BC0F8\"/>\n<path d=\"M12 48 H116 L64 112Z\" fill=\"#2F9BE0\"/>\n<path d=\"M36 22 L48 48 L64 22 L80 48 L92 22\" fill=\"#9BDCFF\"/>\n<path d=\"M48 48 L64 112 L80 48Z\" fill=\"#7FCFFA\"/>\n<path d=\"M40 30 L46 40\" stroke=\"#FFFFFF\" stroke-width=\"4\" stroke-linecap=\"round\"/></svg>"
  }
];

const BY_ID = new Map(BEAUTY_EMOJIS.map((item) => [item.id, item]));

export function getBeautyEmoji(id) {
  return BY_ID.get(String(id || "")) || null;
}

export function isBeautyEmojiId(id) {
  return BY_ID.has(String(id || ""));
}

/** Data-URI form of an icon, for <img src>. Returns "" for unknown ids. */
export function beautyEmojiSrc(id) {
  const item = getBeautyEmoji(id);
  return item ? `data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}` : "";
}

/**
 * Best-guess icon for a service that has no explicit emoji (older rows,
 * free-text names). Matches Persian keywords against the service name.
 */
const KEYWORD_RULES = [
  ["bridal", ["عروس"]],
  ["hair_color", ["رنگ مو", "رنگ و"]],
  ["highlights", ["لایت", "هایلایت", "بالیاژ", "آمبره"]],
  ["keratin", ["کراتین", "احیا", "پروتئین"]],
  ["hair_extension", ["اکستنشن مو", "کلیپ"]],
  ["braid", ["بافت", "میکروبراید"]],
  ["updo", ["شینیون"]],
  ["blowdry", ["براشینگ", "سشوار"]],
  ["hair_styling", ["فر ", "حالت"]],
  ["hair_wash", ["شستشو", "ماسک مو"]],
  ["barber", ["اصلاح آقایان", "آرایشگاه مردانه", "ریش"]],
  ["haircut", ["کوتاه"]],
  ["lash_lift", ["لیفت مژه"]],
  ["lash_ext", ["مژه"]],
  ["eyebrow", ["ابرو"]],
  ["tattoo", ["تاتو", "میکروبلیدینگ", "بلیدینگ", "microblading"]],
  ["eyeshadow", ["سایه"]],
  ["makeup_brush", ["گریم", "کانتور"]],
  ["lips", ["لب", "فیلر لب"]],
  ["lipstick", ["میکاپ", "آرایش"]],
  ["gel_nails", ["ژلیش", "کاشت", "پودر"]],
  ["nail_art", ["طراحی ناخن", "نیل آرت"]],
  ["pedicure", ["پدیکور"]],
  ["manicure", ["مانیکور", "ناخن"]],
  ["hydrafacial", ["هیدرافیشیال", "آبرسانی"]],
  ["peeling", ["لایه", "پیلینگ"]],
  ["serum", ["سرم", "مزوتراپی", "پ.ر.پی", "prp"]],
  ["facial", ["فیشیال", "پاکسازی"]],
  ["skincare", ["پوست"]],
  ["injection", ["بوتاکس", "تزریق", "فیلر"]],
  ["laser", ["لیزر"]],
  ["teeth", ["بلیچینگ", "لمینت", "دندان"]],
  ["waxing", ["وکس", "اپیلاسیون", "نخ"]],
  ["massage", ["ماساژ"]],
  ["aroma", ["آروما"]],
  ["spa", ["اسپا", "سونا", "جکوزی"]],
  ["tanning", ["برنزه"]],
  ["body_contour", ["لاغری", "فرم‌دهی بدن", "کویتیشن"]],
  ["perfume", ["عطر"]],
  ["rejuvenation", ["جوان"]],
  ["consult", ["مشاوره"]],
  ["gift", ["هدیه", "پکیج"]],
  ["vip", ["vip", "ویژه"]],
  ["haircut", ["مو"]]
];

export function guessBeautyEmojiId(name) {
  const text = String(name || "").toLowerCase();
  if (!text) return "";
  for (const [id, words] of KEYWORD_RULES) {
    if (words.some((word) => text.includes(word))) return id;
  }
  return "";
}
