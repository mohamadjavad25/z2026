import { Brush, Scissors, UserRound } from "lucide-react";

export const profileRoles = [
  {
    id: "client",
    label: "مشتری",
    hint: "سالن پیدا کن و نوبت بگیر",
    icon: UserRound,
    image: "/role-client.png",
    tone: "roleClient"
  },
  {
    id: "salon",
    label: "سالن",
    hint: "نوبت‌ها و تیم سالنت",
    icon: Scissors,
    image: "/role-salon.png",
    tone: "roleSalon"
  },
  {
    id: "artist",
    label: "آرتیست",
    hint: "نمونه‌کار و نوبت",
    icon: Brush,
    image: "/role-artist.png",
    tone: "roleArtist"
  }
];

export const profileRoleMeta = {
  client: {
    kicker: "پروفایل مشتری",
    desc: "نوبت گرفتن از سالن‌ها و آرتیست‌ها",
    heroClass: "is-client",
    overviewLabel: "پروفایل",
    overviewIcon: UserRound
  },
  salon: {
    kicker: "داشبورد سالن",
    desc: "نوبت‌ها، تیم، ساعت کاری و نمونه‌کارها",
    heroClass: "is-salon",
    overviewLabel: "داشبورد",
    overviewIcon: Scissors
  },
  artist: {
    kicker: "پروفایل آرتیست",
    desc: "نمونه‌کار، نوبت مستقیم و مشتری تازه",
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

export const salonArtistRoleOptions = ["ناخن‌کار", "رنگ و لایت", "میکاپ آرتیست", "ابرو و پوست", "براشینگ و شینیون", "کراتین و احیا"];
