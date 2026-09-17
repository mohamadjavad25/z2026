import { Crown, Palette, ShoppingBag, Store } from "lucide-react";

export const profileRoles = [
  {
    id: "client",
    label: "بانو",
    hint: "کشف، تست و رزرو",
    icon: Crown,
    tone: "roleClient"
  },
  {
    id: "salon",
    label: "سالن زیبایی",
    hint: "رزرو و تیم سالن",
    icon: Store,
    tone: "roleSalon"
  },
  {
    id: "shop",
    label: "فروشگاه",
    hint: "ویترین محصولات",
    icon: ShoppingBag,
    tone: "roleShop"
  },
  {
    id: "artist",
    label: "آرتیست",
    hint: "نمونه‌کار و رزرو",
    icon: Palette,
    tone: "roleArtist"
  }
];

export const profileRoleMeta = {
  client: {
    kicker: "پروفایل بانو",
    desc: "رزرو نوبت از سالن‌ها و آرتیست‌ها",
    heroClass: "is-client",
    overviewLabel: "پروفایل",
    overviewIcon: Crown
  },
  salon: {
    kicker: "داشبورد سالن",
    desc: "رزروها، پرسنل، ساعت کاری و نمونه‌کارها",
    heroClass: "is-salon",
    overviewLabel: "داشبورد",
    overviewIcon: Store
  },
  shop: {
    kicker: "پنل فروش فروشگاه",
    desc: "ویترین محصولات، مدیریت سفارش و ارسال",
    heroClass: "is-shop",
    overviewLabel: "محصولات",
    overviewIcon: ShoppingBag
  },
  artist: {
    kicker: "پروفایل آرتیست",
    desc: "نمونه‌کار، رزرو مستقیم و جذب مشتری",
    heroClass: "is-artist",
    overviewLabel: "پروفایل",
    overviewIcon: Palette
  }
};

export const salonRegistrationServices = ["ناخن", "مو و رنگ", "میکاپ", "پوست و ابرو"];
export const shopRegistrationCategories = ["میکاپ", "پوست", "ناخن", "مو", "عطر", "ترکیبی"];
export const artistSpecialties = ["ناخن", "مو و رنگ", "میکاپ", "پوست و ابرو", "عروس", "چند تخصص"];
export const salonArtistRoleOptions = ["ناخن‌کار", "رنگ و لایت", "میکاپ آرتیست", "ابرو و پوست", "براشینگ و شینیون", "کراتین و احیا"];
export const salonArtistStatusOptions = ["فعال", "غیرفعال", "مرخصی"];
