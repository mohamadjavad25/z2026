import { buildUpcomingWeekDays } from "../../shared/lib/time";

export const artistBookingDays = ["امروز", "فردا", "پس‌فردا"];
export const salonClientBookingDays = buildUpcomingWeekDays(7);

export const artistBookingHistoryFilters = [
  { id: "all", label: "همه" },
  { id: "month", label: "ماه‌ها" },
  { id: "week", label: "هفته‌ها" },
  { id: "day", label: "روز" }
];

export const artistBookingHistoryRank = { day: 1, week: 2, month: 3 };

export const publicArtistServicePresets = {};

export const publicArtistServiceFallback = [
  { id: "pub-default-1", name: "مشاوره زیبایی", price: "رایگان", duration: "۲۰ دقیقه", badge: "شروع", hint: "بررسی نیاز و پیشنهاد سرویس", tone: "soft" },
  { id: "pub-default-2", name: "سرویس تخصصی", price: "از ۲.۵ م", duration: "۹۰ دقیقه", badge: "پرطرفدار", hint: "بر اساس تخصص آرتیست", tone: "hot" },
  { id: "pub-default-3", name: "سرویس VIP", price: "از ۶.۵ م", duration: "۱۵۰ دقیقه", badge: "VIP", hint: "جزئیات کامل و اختصاصی", tone: "vip" }
];

export function getPublicArtistServices(artist) {
  if (Array.isArray(artist?.services) && artist.services.length) {
    return artist.services.map((service) => ({
      ...service,
      id: service.id || `svc-${service.name}`,
      tone: service.tone || "soft"
    }));
  }
  const role = String(artist?.role || "");
  return publicArtistServicePresets[role] || publicArtistServiceFallback;
}
