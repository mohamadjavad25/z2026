import { Brush, Scissors, UserRound } from "lucide-react";

export const profileRoles = [
  {
    id: "client",
    label: "بانو",
    hint: "کشف، تست و رزرو",
    icon: UserRound,
    tone: "roleClient"
  },
  {
    id: "salon",
    label: "سالن زیبایی",
    hint: "رزرو و تیم سالن",
    icon: Scissors,
    tone: "roleSalon"
  },
  {
    id: "artist",
    label: "آرتیست",
    hint: "نمونه‌کار و رزرو",
    icon: Brush,
    tone: "roleArtist"
  }
];

export const profileRoleMeta = {
  client: {
    kicker: "پروفایل بانو",
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
// salon/artist signup forms (SpecialtyMultiSelect.jsx). Deliberately broader
// than the old single-select list -- a person can still add anything not
// listed here via the dropdown's own "add" field.
export const beautySpecialtyOptions = [
  "ناخن",
  "کاشت ناخن",
  "ژل و لاک",
  "مو و رنگ",
  "کراتینه و احیا",
  "اکستنشن مو",
  "میکاپ",
  "میکاپ عروس",
  "ابرو و میکروبلیدینگ",
  "لمینت مژه و ابرو",
  "پوست و اپیلاسیون",
  "وکس بدن",
  "ماساژ و اسپا",
  "حنا و مهندی"
];

// Kept for any older import still expecting these two names.
export const salonRegistrationServices = beautySpecialtyOptions;
export const artistSpecialties = beautySpecialtyOptions;
export const salonArtistRoleOptions = ["ناخن‌کار", "رنگ و لایت", "میکاپ آرتیست", "ابرو و پوست", "براشینگ و شینیون", "کراتین و احیا"];
export const salonArtistStatusOptions = ["فعال", "غیرفعال", "مرخصی"];
