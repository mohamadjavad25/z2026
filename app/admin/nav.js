/**
 * The admin's map. Every page lives in one of a few clearly named groups, and every page says in one line what it is for.
 * `badges` on the rail (e.g. waiting support tickets) are keyed by page id.
 */
export const SECTIONS = [
  { id: "home", label: "", items: [{ id: "overview", label: "نمای کلی", desc: "خلاصهٔ همه‌چیز: آمار، هشدارها و آخرین اتفاقات" }] },
  {
    id: "manage",
    label: "مدیریت",
    items: [
      { id: "users", label: "کاربران", desc: "همهٔ حساب‌ها: جست‌وجو، ویرایش، پیام‌دادن، مسدودکردن" },
      { id: "content", label: "محتوا", desc: "پست‌های نمونه‌کار: بررسی، پنهان‌کردن و حذف" },
      { id: "bookings", label: "رزروها", desc: "همهٔ رزروهای سالن‌ها و آرتیست‌ها برای پیگیری شکایت‌ها" }
    ]
  },
  {
    id: "help",
    label: "ارتباط با کاربران",
    items: [
      { id: "support", label: "پشتیبانی", desc: "پیام‌ها و گزارش‌های کاربران؛ پاسخ بده و پیگیری کن" },
      { id: "resets", label: "بازیابی رمز", desc: "درخواست کاربرانی که رمزشان را فراموش کرده‌اند" }
    ]
  },
  {
    id: "safety",
    label: "امنیت",
    items: [
      { id: "security", label: "امنیت و دسترسی", desc: "حساب‌های مدیر، نشست‌های فعال و تلاش‌های ورود" },
      { id: "actions", label: "گزارش فعالیت‌ها", desc: "هر کاری که مدیرها انجام داده‌اند، با زمان و نام" }
    ]
  }
];

export const TABS = SECTIONS.flatMap((section) => section.items);
export const tabInfo = (id) => TABS.find((tab) => tab.id === id) || TABS[0];
