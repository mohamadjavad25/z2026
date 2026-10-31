import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { phoneLast10 } from "../../shared/lib/phone";
import { nameKey } from "../../lib/businessName";
import { formatPersianDayTitle, isSamePersianDay, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";

const CANCELLED = new Set(["لغو", "منقضی شده"]);

/** Last 10 digits of a phone, so 0912…, +98912… and Persian-digit input all match. */
export function phoneKey(phone) {
  return phoneLast10(phone);
}

function isAccountDeleted(booking) {
  return Boolean(booking.client_account_deleted_at || booking.clientAccountDeletedAt);
}

function customerKey(booking) {
  // A deleted account's bookings lost their number: kept apart from a walk-in who happens to share the name.
  if (isAccountDeleted(booking)) return booking.client ? `deleted:${String(booking.client).trim()}` : null;
  const phone = phoneKey(booking.phone);
  const id = booking.client_user_id || booking.clientUserId;
  return (
    (phone && `phone:${phone}`)
    || (id && `id:${id}`)
    || (booking.client && `name:${String(booking.client).trim()}`)
    || null
  );
}

function bookingTime(booking) {
  const raw = booking.booking_date || booking.date || "";
  if (!raw) return null;
  const time = resolveRollingPersianDate(raw).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Groups an owner's real bookings (salonAppointmentList for a salon,
 * artistBookingList for an artist) into one row per real-world customer.
 * Shared by the customers page and the booking-create form's name lookup.
 * Rows arrive newest first, so the first booking seen per customer is the
 * most recent one. A customer is keyed by phone first (so a walk-in and the
 * same person's registered account merge), then account id, then name.
 *
 * `followers` (GET /api/followers) are people who followed this owner: each is
 * a contact too. One who already booked is merged into that customer (and
 * marked as a follower); one who has not booked yet becomes a customer with
 * `noBookingYet` so the owner can see who still needs a first reason to come.
 *
 * Bookings the owner took off the list («از لیست مشتری‌هام بردار», `customers_hidden_at`) make no row. A customer
 * whose account was deleted gets `accountDeleted`; one with no number left (deleted or a walk-in) gets `removable`.
 */
export function buildBookingCustomers(bookings = [], followers = []) {
  const todayTime = resolveRollingPersianDate("امروز").getTime();
  const byKey = new Map();
  bookings.forEach((booking) => {
    if (booking.customers_hidden_at || booking.customersHiddenAt) return;
    const key = customerKey(booking);
    if (!key) return;
    let customer = byKey.get(key);
    if (!customer) {
      customer = {
        key,
        name: booking.client || "مشتری",
        phone: booking.phone || "",
        avatar: booking.client_avatar || booking.clientAvatar || "",
        lastService: booking.service || "",
        lastDate: booking.booking_date || booking.date || "",
        visitCount: 0,
        completed: 0,
        noShow: 0,
        upcoming: 0,
        cancelled: 0,
        lastVisitTime: 0,
        nextTime: 0,
        followedAt: 0,
        isFollower: false,
        isNewFollower: false,
        followedToday: false,
        hasBooked: true,
        noBookingYet: false,
        accountDeleted: isAccountDeleted(booking),
        accountName: "",
        nameStats: new Map(),
        bookings: []
      };
      byKey.set(key, customer);
    }
    if (!customer.phone && booking.phone) customer.phone = booking.phone;
    if (!customer.avatar) customer.avatar = booking.client_avatar || booking.clientAvatar || "";
    customer.bookings.push(booking);
    const stat = nameStatFor(customer, booking);

    if (CANCELLED.has(booking.status)) {
      customer.cancelled += 1;
      if (stat) stat.cancelled += 1;
      return;
    }
    customer.visitCount += 1;
    if (stat) stat.visitCount += 1;
    const time = bookingTime(booking);
    const isPast = time !== null && time < todayTime;
    // «نیومد» (the salon or artist marked it): a booking, but not a visit.
    if (booking.no_show_at || booking.noShowAt) {
      customer.noShow += 1;
      if (stat) stat.noShow += 1;
      return;
    }
    if (booking.status === "تایید شده" && isPast) {
      customer.completed += 1;
      if (stat) stat.completed += 1;
      customer.lastVisitTime = Math.max(customer.lastVisitTime, time);
    } else if (!isPast) {
      customer.upcoming += 1;
      if (stat) stat.upcoming += 1;
      if (time !== null && (!customer.nextTime || time < customer.nextTime)) customer.nextTime = time;
    }
  });
  const now = new Date();
  [...followers]
    .sort((a, b) => followTime(b) - followTime(a))
    .forEach((follower) => {
      const phone = phoneKey(follower.phone);
      const id = follower.userId;
      const keys = [phone && `phone:${phone}`, id && `id:${id}`].filter(Boolean);
      let customer = keys.map((key) => byKey.get(key)).find(Boolean);
      if (!customer) {
        customer = {
          key: keys[0] || `follower:${follower.name}`,
          name: follower.name || "مشتری تازه",
          phone: follower.phone || "",
          avatar: follower.avatar || "",
          lastService: "",
          lastDate: "",
          visitCount: 0,
          completed: 0,
        noShow: 0,
          upcoming: 0,
          cancelled: 0,
          lastVisitTime: 0,
          nextTime: 0,
          bookings: []
        };
        byKey.set(customer.key, customer);
      }
      const since = followTime(follower);
      // A follower is a registered account: its name is the person's own, whatever a booking was typed with.
      if (follower.userId && follower.name && !customer.accountDeleted) customer.accountName = customer.accountName || follower.name;
      customer.isFollower = true;
      customer.followedAt = since;
      customer.isNewFollower = Boolean(follower.isNew);
      customer.followedToday = since > 0 && isSamePersianDay(new Date(since), now);
      customer.hasBooked = customer.visitCount > 0 || customer.cancelled > 0 || Boolean(follower.hasBooked);
      customer.noBookingYet = !customer.hasBooked;
      if (!customer.avatar && follower.avatar) customer.avatar = follower.avatar;
      if (!customer.phone && follower.phone) customer.phone = follower.phone;
    });
  return [...byKey.values()].map((customer) => {
    const { nameStats, ...rest } = customer;
    return {
      ...rest,
      ...resolveNames(customer, nameStats),
      accountDeleted: Boolean(customer.accountDeleted),
      removable: !customer.phone && !customer.isFollower && customer.bookings.length > 0
    };
  });
}

/**
 * One phone can carry several names (a mother booking for her daughter, a friend's name once). The customers list keeps
 * ONE card per phone (owner's decision 2026-10-31) and remembers every name on it: `names` (each with its own counts,
 * the main one first) and `otherNames`. Names that differ only in spaces, case or Arabic letter forms are one name
 * (`nameKey`, the rule used for salon names); «مریم» and «مریم جون» are two.
 */
function nameStatFor(customer, booking) {
  const name = String(booking.client || "").trim();
  const key = nameKey(name);
  if (!key) return null;
  let stat = customer.nameStats.get(key);
  if (!stat) {
    stat = { key, name, order: customer.nameStats.size, visitCount: 0, completed: 0, noShow: 0, upcoming: 0, cancelled: 0 };
    customer.nameStats.set(key, stat);
  }
  // What a salon or artist typed is not the account's name: the server sends that one on its own.
  const accountName = String(booking.client_account_name || booking.clientAccountName || "").trim();
  if (!customer.accountName && accountName && !isAccountDeleted(booking)) customer.accountName = accountName;
  return stat;
}

/**
 * The main name: the account's own name when the person has an account; otherwise the name used most; on a tie the
 * newest (rows arrive newest first, so the first one seen).
 */
function resolveNames(customer, nameStats) {
  const stats = nameStats ? [...nameStats.values()] : [];
  const accountKey = customer.accountName ? nameKey(customer.accountName) : "";
  if (accountKey && !stats.some((stat) => stat.key === accountKey)) {
    stats.push({ key: accountKey, name: customer.accountName, order: stats.length, visitCount: 0, completed: 0, noShow: 0, upcoming: 0, cancelled: 0 });
  }
  if (!stats.length) {
    const key = nameKey(customer.name);
    return { names: key ? [{ key, name: customer.name, order: 0, visitCount: 0, completed: 0, noShow: 0, upcoming: 0, cancelled: 0, isMain: true }] : [], otherNames: [] };
  }
  const main = stats.find((stat) => stat.key === accountKey)
    || [...stats].sort((a, b) => (b.visitCount + b.cancelled) - (a.visitCount + a.cancelled) || a.order - b.order)[0];
  const names = [main, ...stats.filter((stat) => stat !== main).sort((a, b) => a.order - b.order)]
    .map((stat) => ({ ...stat, isMain: stat === main }));
  return { name: main.name, names, otherNames: names.filter((item) => !item.isMain).map((item) => item.name) };
}

/** Does this customer match what was typed in the search box? Any of their names, or the number. */
export function customerMatchesQuery(customer, text) {
  const q = String(text || "").trim();
  if (!q) return true;
  const names = customer.names?.length ? customer.names.map((item) => item.name) : [customer.name];
  return names.some((name) => String(name || "").includes(q)) || toLatinDigits(customer.phone).includes(toLatinDigits(q));
}

/**
 * Typing a name for a number the owner already has under another name (owner's decision 2026-10-31):
 * - null: nothing to ask (no number, no name, the number is new, or this name is already one of its names);
 * - { type: "account", accountName }: the number belongs to a frfro account, so its own name is used, no question;
 * - { type: "ask", mainName, names, typed }: ask «همون اسم قبلی»، «اسم رو عوض کن»، «هر دو باشن».
 */
export function findNameConflict(customers = [], phone, name) {
  const pk = phoneKey(phone);
  const key = nameKey(name);
  if (pk.length < 10 || !key) return null;
  const customer = customers.find((item) => !item.accountDeleted && phoneKey(item.phone) === pk);
  if (!customer || !customer.names?.length) return null;
  if (customer.names.some((item) => item.key === key)) return null;
  if (customer.accountName) return { type: "account", accountName: customer.accountName, names: customer.names.map((item) => item.name), typed: String(name).trim() };
  return { type: "ask", mainName: customer.name, names: customer.names.map((item) => item.name), typed: String(name).trim() };
}

/**
 * For the bookings list: for each booking, the OTHER names booked with the same number («هم‌شماره با …»).
 * `lookup(booking)` returns [] when the number is shared with nobody.
 */
export function buildSharedPhoneLookup(bookings = []) {
  const byPhone = new Map();
  bookings.forEach((booking) => {
    if (booking.customers_hidden_at || booking.customersHiddenAt) return;
    const phone = phoneKey(booking.phone);
    const name = String(booking.client || "").trim();
    const key = nameKey(name);
    if (phone.length < 10 || !key) return;
    if (!byPhone.has(phone)) byPhone.set(phone, new Map());
    const names = byPhone.get(phone);
    if (!names.has(key)) names.set(key, name);
  });
  return (booking) => {
    const names = byPhone.get(phoneKey(booking?.phone));
    if (!names || names.size < 2) return [];
    const own = nameKey(booking?.client);
    return [...names.entries()].filter(([key]) => key !== own).map(([, name]) => name);
  };
}

/** «هم‌شماره با سارا»، «هم‌شماره با سارا و علی»، «هم‌شماره با سارا و ۲ نفر دیگه»: the tag on a booking card. */
export function sharedPhoneLabel(names = []) {
  if (!names.length) return "";
  if (names.length === 1) return `هم‌شماره با ${names[0]}`;
  if (names.length === 2) return `هم‌شماره با ${names[0]} و ${names[1]}`;
  return `هم‌شماره با ${names[0]} و ${toPersianDigits(names.length - 1)} نفر دیگه`;
}

function followTime(follower) {
  const time = new Date(follower?.followedAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * The people to greet at the top of the customers page: followers from today,
 * plus anyone still unseen even if they followed earlier (the owner may not have
 * opened the app for days). Newest first.
 */
export function pickFreshFollowers(customers = []) {
  return customers
    .filter((customer) => customer.isFollower && (customer.followedToday || customer.isNewFollower))
    .sort((a, b) => b.followedAt - a.followedAt);
}

const MINUTE_MS = 60 * 1000;

/** «همین الان» / «۱۲ دقیقه پیش» / «امروز ساعت ۱۴:۳۰» / «دیروز» / «۳ آبان»: when someone followed, in plain words. */
export function describeFollowTime(time, now = new Date()) {
  if (!time) return "";
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  if (isSamePersianDay(date, now)) {
    const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(date);
    return `امروز ساعت ${toPersianDigits(clock)}`;
  }
  const yesterday = new Date(now.getTime() - 24 * 60 * MINUTE_MS);
  if (isSamePersianDay(date, yesterday)) return "دیروز";
  const title = formatPersianDayTitle(date);
  return `${title.day} ${title.monthLabel}`;
}
