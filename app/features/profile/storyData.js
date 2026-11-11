/** What the story maker reads before it draws: the free times of the next three days and the works that have a picture. */
import { getPosts } from "../../shared/api/posts";
import { getSalonServices, getSalonVisitTimes } from "../../shared/api/salons";
import { getArtist } from "../../shared/api/artists";
import { artistFreeTimes } from "../../shared/lib/artistFreeTimes";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { isTooSoonToRequest } from "../../shared/lib/bookingWindow";
import { parseServiceDurationMinutes } from "../../shared/lib/time";
import { nowDate } from "../../shared/lib/clock.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ["امروز", "فردا", "پس‌فردا"];

/** Today, tomorrow and the day after, as dates and Persian day keys. */
function nextDays() {
  const now = nowDate();
  return DAY_LABELS.map((label, i) => {
    const date = new Date(now.getTime() + i * DAY_MS);
    return { label, date, key: formatPersianDateKey(date) };
  });
}

/**
 * Free start times for today, tomorrow and the day after, as a client could still request them, for the shortest
 * service. A salon asks the server (the booking rules live there); an artist's times are worked out from the public
 * page's data with the booking sheet's own rule (artistFreeTimes: working hours, workplace salon, busy list, break,
 * leaves), so the story never offers a time the sheet would not. A closed or hidden page offers nothing.
 */
export async function loadFreeSlots(profileType, profileId) {
  const days = nextDays();
  if (profileType === "salon") {
    const services = await getSalonServices();
    if (!services.ok) throw new Error("services");
    const list = services.data?.services || [];
    const shortest = [...list].sort((a, b) => (Number(a.duration) || Infinity) - (Number(b.duration) || Infinity))[0];
    if (!shortest) return days.map((day) => ({ ...day, times: [] }));
    return Promise.all(days.map(async (day) => {
      const { ok, data } = await getSalonVisitTimes(profileId, day.key, [shortest.name]);
      if (!ok) throw new Error("times");
      const times = (data?.times || []).filter((time) => !isTooSoonToRequest(day.key, time));
      return { ...day, times, service: shortest.name };
    }));
  }

  const { ok, data } = await getArtist(profileId);
  if (!ok) throw new Error("artist");
  const artist = data?.artist;
  if (!artist || !artist.isPublic || artist.onlineBookingPaused) return days.map((day) => ({ ...day, times: [] }));
  const list = artist.services || [];
  const shortest = [...list].sort((a, b) => parseServiceDurationMinutes(a.duration) - parseServiceDurationMinutes(b.duration))[0];
  if (!shortest) return days.map((day) => ({ ...day, times: [] }));
  const minutes = parseServiceDurationMinutes(shortest.duration);
  return days.map((day) => ({ ...day, service: shortest.name, times: artistFreeTimes(artist, day.key, minutes) }));
}

/** Public posts that have a picture, newest first, for the collage and the photo behind the free times. */
export async function loadWorks() {
  const res = await getPosts();
  if (!res.ok) return [];
  // The API sends `image` and `isPublic` (it used to be read as image_url, so the collage never found any work).
  return (res.data?.posts || [])
    .filter((post) => post.image && post.isPublic !== false)
    .map((post) => ({ src: post.image }));
}
