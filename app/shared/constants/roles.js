import { Brush, Scissors, UserRound } from "lucide-react";

export const profileRoles = [
  {
    id: "client",
    label: "مشتری",
    hint: "کشف، تست و رزرو",
    icon: UserRound,
    image: "/role-client.png",
    tone: "roleClient"
  },
  {
    id: "salon",
    label: "سالن",
    hint: "رزرو و تیم سالن",
    icon: Scissors,
    image: "/role-salon.png",
    tone: "roleSalon"
  },
  {
    id: "artist",
    label: "آرتیست",
    hint: "نمونه‌کار و رزرو",
    icon: Brush,
    image: "/role-artist.png",
    tone: "roleArtist"
  }
];

export const profileRoleMeta = {
  client: {
    kicker: "پروفایل مشتری",
    desc: "رزرو نوبت از سالن‌ها و آرتیست‌ها",
    heroClass: "is-client",
    overviewLabel: "پروفایل",
    overviewIcon: UserRound
  },
  salon: {
    kicker: "داشبورد سالن",
    desc: "رزروها، پرسنل، ساعت کاری و نمونه‌کارها",
    heroClass: "is-salon",
    overviewLabel: "داشبورد",
    overviewIcon: Scissors
  },
  artist: {
    kicker: "پروفایل آرتیست",
    desc: "نمونه‌کار، رزرو مستقیم و جذب مشتری",
    heroClass: "is-artist",
    overviewLabel: "پروفایل",
    overviewIcon: Brush
  }
};

// Base specialty/service catalog shown in the multi-select dropdown on the
// salon/artist signup forms (SpecialtyMultiSelect.jsx) -- main service
// categories, not every possible sub-treatment. A user who doesn't find
// what they're after adds it themselves via the dropdown's own "add"
// field (kept in that dropdown's local component state only, so it never
// becomes part of any other user's list -- see SpecialtyMultiSelect.jsx).
export const beautySpecialtyOptions = [
  "ناخن",
  "کوتاهی و مدل مو",
  "رنگ مو",
  "کراتین و احیا",
  "اکستنشن مو",
  "میکاپ",
  "آرایش عروس",
  "ابرو و مژه",
  "پوست و پاکسازی",
  "بوتاکس و فیلر",
  "لیزر",
  "اپیلاسیون و وکس",
  "ماساژ و اسپا"
];

// Kept for any older import still expecting these two names.
export const salonRegistrationServices = beautySpecialtyOptions;
export const artistSpecialties = beautySpecialtyOptions;
export const salonArtistRoleOptions = ["ناخن‌کار", "رنگ و لایت", "میکاپ آرتیست", "ابرو و پوست", "براشینگ و شینیون", "کراتین و احیا"];
export const salonArtistStatusOptions = ["فعال", "غیرفعال", "مرخصی"];
