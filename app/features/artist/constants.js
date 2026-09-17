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

// Bug fix: this used to fall back to 3 hardcoded fake services (fake prices,
// fake durations) whenever a real artist had none configured, so every
// service-less artist showed identical made-up offerings indistinguishable
// from real ones. Now it always reflects the real data — PublicArtistServicesPanel
// already has an honest "هنوز خدمتی ثبت نشده" empty state for this case.
export function getPublicArtistServices(artist) {
  const services = Array.isArray(artist?.services) ? artist.services : [];
  return services.map((service) => ({
    ...service,
    id: service.id || `svc-${service.name}`,
    tone: service.tone || "soft"
  }));
}
