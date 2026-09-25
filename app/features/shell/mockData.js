export const initialArtistServices = [];
export const initialArtistPortfolioItems = [];
export const initialArtistBookings = [];

export const salonDetailTeam = [];
export const salonDetailPortfolio = [];
export const explorePosts = [];
export const exploreArtistCatalog = {};

export const profileBoards = {
  client: [
    { title: "فرنچ کروم رز", meta: "ذخیره‌شده از اکسپلور", tile: "tile1", tag: "ناخن" },
    { title: "بالیاژ کاراملی", meta: "مناسب تناژ گرم", tile: "tile3", tag: "مو" },
    { title: "میکاپ نود", meta: "برای تست بعدی AI", tile: "tile4", tag: "میکاپ" },
    { title: "ابروی طبیعی", meta: "مدل پیشنهادی", tile: "tile5", tag: "ابرو" }
  ],
  salon: [
    { title: "نمونه‌کار ناخن", meta: "آماده انتشار", tile: "tile1", tag: "ناخن" },
    { title: "رنگ موی لوکس", meta: "پست پیشنهادی هفته", tile: "tile3", tag: "مو" },
    { title: "میکاپ گلوئی", meta: "مناسب جذب رزرو", tile: "tile4", tag: "میکاپ" },
    { title: "جزئیات عروس", meta: "کالکشن ویژه", tile: "tile8", tag: "عروس" }
  ]
};

export const salonAppointments = [
  { time: "۱۰:۳۰", client: "نازی", service: "ژلیش دارک", staff: "مهسا", status: "تایید" },
  { time: "۱۳:۰۰", client: "رها", service: "رنگ ریشه", staff: "لنا", status: "در انتظار" },
  { time: "۱۶:۱۵", client: "سارا", service: "میکاپ نود", staff: "آوا", status: "VIP" }
];

export const salonStaff = [
  { name: "مهسا", role: "ناخن‌کار", booked: "۵ وقت", state: "فعال" },
  { name: "لنا", role: "رنگ و لایت", booked: "۳ وقت", state: "آزاد ۱۵:۳۰" },
  { name: "آوا", role: "میکاپ", booked: "۲ وقت", state: "فعال" }
];

export const salonServices = [
  { name: "ناخن", price: "از ۶۵۰ ه", duration: "۹۰ دقیقه" },
  { name: "رنگ مو", price: "از ۱.۸ م", duration: "۱۸۰ دقیقه" },
  { name: "میکاپ", price: "از ۲.۴ م", duration: "۱۲۰ دقیقه" }
];

export const salonInventory = [
  { item: "رنگ ۷.۳", level: "کم", tone: "warn" },
  { item: "ژل بیس", level: "خوب", tone: "ok" },
  { item: "اکسیدان ۶٪", level: "متوسط", tone: "mid" }
];

export const salonTasks = [
  "تایید ۲ رزرو در انتظار",
  "آپلود ۳ نمونه‌کار هفته",
  "تنظیم ظرفیت مهسا برای پنجشنبه"
];
