import {
  Activity, BarChart3, CalendarCheck, CreditCard, Image as ImageIcon, KeyRound, LayoutDashboard, LifeBuoy, Megaphone, ScrollText, Settings2, ShieldCheck, Users
} from "lucide-react";

/**
 * The admin's map. Every page lives in one of a few clearly named groups, says in one line what it is for, and has a
 * keyboard shortcut: press g, then the key (e.g. g then u opens Users). `badges` on the rail are keyed by page id.
 */
export const SECTIONS = [
  { id: "home", label: "", items: [{ id: "overview", label: "نمای کلی", desc: "خلاصهٔ همه‌چیز: آمار زنده، هشدارها و آخرین اتفاقات", icon: LayoutDashboard, key: "o" }] },
  {
    id: "manage",
    label: "مدیریت",
    items: [
      { id: "users", label: "کاربران", desc: "همهٔ حساب‌ها: جست‌وجو، فیلتر، ویرایش، پیام، مسدودکردن، کارهای گروهی", icon: Users, key: "u" },
      { id: "bookings", label: "رزروها", desc: "همهٔ رزروهای سالن‌ها و آرتیست‌ها؛ جزئیات هر رزرو و لغو در صورت شکایت", icon: CalendarCheck, key: "b" },
      { id: "payments", label: "پرداخت‌ها", desc: "اشتراک سالن‌ها و آرتیست‌ها: روشن و خاموش، درگاه، درآمد، همهٔ پرداخت‌ها و افزودن روز", icon: CreditCard, key: "f" },
      { id: "content", label: "محتوا", desc: "پست‌های نمونه‌کار با تصویر: بررسی گزارش‌ها، پنهان‌کردن و حذف", icon: ImageIcon, key: "c" }
    ]
  },
  {
    id: "talk",
    label: "ارتباط با کاربران",
    items: [
      { id: "support", label: "پشتیبانی", desc: "پیام‌ها و گزارش‌های کاربران؛ پاسخ بده و پیگیری کن", icon: LifeBuoy, key: "s" },
      { id: "broadcast", label: "پیام همگانی", desc: "یک پیام به یک گروه از کاربران: در صندوق پشتیبانی‌شان و با اعلان گوشی", icon: Megaphone, key: "m" },
      { id: "resets", label: "بازیابی رمز", desc: "درخواست کاربرانی که رمزشان را فراموش کرده‌اند", icon: KeyRound, key: "p" }
    ]
  },
  {
    id: "insight",
    label: "گزارش و پایش",
    items: [
      { id: "reports", label: "گزارش‌ها", desc: "پرکارترین‌ها، ساعت‌های شلوغ، قیف مشتری و سالن‌ها و آرتیست‌هایی که هنوز آماده نیستند", icon: BarChart3, key: "r" },
      { id: "health", label: "سلامت سامانه", desc: "پایگاه داده، تنظیمات سرور، پیامک، اعلان و خطاهای اپ روی گوشی کاربران", icon: Activity, key: "h" }
    ]
  },
  {
    id: "system",
    label: "سامانه و امنیت",
    items: [
      { id: "settings", label: "تنظیمات", desc: "اعلان بالای اپ، باز و بسته‌کردن ثبت‌نام و پاسخ‌های آماده", icon: Settings2, key: "t" },
      { id: "security", label: "امنیت و دسترسی", desc: "حساب‌های مدیر، نشست‌های فعال و تلاش‌های ورود", icon: ShieldCheck, key: "x" },
      { id: "actions", label: "گزارش فعالیت‌ها", desc: "هر کاری که مدیرها انجام داده‌اند، با زمان، نام و جزئیات", icon: ScrollText, key: "a" }
    ]
  }
];

export const TABS = SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, group: section.label })));
export const tabInfo = (id) => TABS.find((tab) => tab.id === id) || TABS[0];
export const isTab = (id) => TABS.some((tab) => tab.id === id);
