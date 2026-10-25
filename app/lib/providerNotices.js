import { sendPushToUser } from "./push.js";
import { smsBookingCancelledByProvider, smsBookingProposal, smsDayLabel, smsTimeLabel } from "./bookingSms.js";
import {
  ARTIST_GONE_TEXT,
  SALON_GONE_TEXT,
  cancelledByProviderText,
  handoverProposalText,
  proposalLapsedClientText,
  providerLabel,
  shortClock,
  timeProposalText
} from "../shared/lib/providerRules.js";

/**
 * What the client and the provider are told when a confirmed booking changes (owner's rules of 2026-10-22). Every
 * function here only fires the messages (push always; SMS through the per-booking claims in bookingSms.js, which
 * also honour «اپ اندروید فقط push») and never throws, so callers use it after their own change has committed.
 *
 * `booking`: { kind: "salon" | "artist", id, booking_date, time, service }; `provider`: { type, name }.
 */
const quiet = (promise) => Promise.resolve(promise).catch(() => {});

/** The provider cancelled a booking (or left frfro): the client's push, in-app card (reads cancelled_by) and SMS. */
export function noticeClientCancelledByProvider(clientUserId, { provider, booking, gone = false }) {
  if (!clientUserId) return;
  const type = provider?.type === "artist" ? "artist" : "salon";
  const body = gone
    ? `${providerLabel(type, provider?.name)} دیگه توی فرفرو نیست و نوبتت (${booking.service || "نوبت"}) لغو شد. می‌تونی یه جای دیگه نوبت بگیری.`
    : cancelledByProviderText(type, provider?.name);
  void quiet(sendPushToUser(Number(clientUserId), { title: gone ? (type === "artist" ? ARTIST_GONE_TEXT : SALON_GONE_TEXT) : "نوبتت لغو شد", body, url: "/" }));
  smsBookingCancelledByProvider(Number(clientUserId), {
    providerName: providerLabel(type, provider?.name),
    bookingDate: booking.booking_date,
    time: booking.time,
    booking: { kind: booking.kind, id: booking.id },
    gone
  });
}

/** The provider proposes another time: push + SMS «… می‌خواهد نوبتت را از ۱۰ به ۱۲ ببرد. قبول می‌کنی؟». */
export function noticeClientTimeProposal(clientUserId, { provider, booking, toDate, toTime }) {
  if (!clientUserId) return;
  const type = provider?.type === "artist" ? "artist" : "salon";
  const sameDay = !toDate || toDate === booking.booking_date;
  const from = sameDay ? shortClock(booking.time) : `${smsDayLabel(booking.booking_date)} ${shortClock(booking.time)}`;
  const to = sameDay ? shortClock(toTime) : `${smsDayLabel(toDate)} ${shortClock(toTime)}`;
  void quiet(sendPushToUser(Number(clientUserId), {
    title: "پیشنهاد ساعت تازه برای نوبتت",
    body: `${timeProposalText(type, provider?.name, from, to)} تا جواب ندی، ساعت قبلی سر جاشه.`,
    url: "/"
  }));
  smsBookingProposal(Number(clientUserId), {
    template: "booking_time_proposal",
    providerName: providerLabel(type, provider?.name),
    booking: { kind: booking.kind, id: booking.id },
    proposalKey: `${toDate || booking.booking_date} ${toTime}`,
    values: { from, to }
  });
}

/** The provider proposes another artist (a team member leaves): push + SMS. */
export function noticeClientHandoverProposal(clientUserId, { provider, booking, fromStaff, toStaff }) {
  if (!clientUserId) return;
  const type = provider?.type === "artist" ? "artist" : "salon";
  void quiet(sendPushToUser(Number(clientUserId), {
    title: "پیشنهاد آرتیست دیگه برای نوبتت",
    body: `${handoverProposalText(type, provider?.name, fromStaff, toStaff)} تا جواب ندی، همه‌چی سر جاشه.`,
    url: "/"
  }));
  smsBookingProposal(Number(clientUserId), {
    template: "booking_handover_proposal",
    providerName: providerLabel(type, provider?.name),
    booking: { kind: booking.kind, id: booking.id },
    proposalKey: `staff:${toStaff}`,
    values: { day: smsDayLabel(booking.booking_date), time: smsTimeLabel(booking.time), artist: toStaff }
  });
}

/** The client answered a proposal: the provider hears it at once. */
export function noticeProviderProposalAnswer(providerUserId, { accepted, booking, clientName, what = "ساعت" }) {
  if (!providerUserId) return;
  void quiet(sendPushToUser(Number(providerUserId), {
    title: accepted ? `مشتری ${what} تازه رو قبول کرد` : "مشتری نوبت رو لغو کرد",
    body: `${clientName || "مشتری"}، ${booking.service || "نوبت"}${accepted ? "" : ": پیشنهادت رو نخواست و نوبت لغو شد."}`.trim(),
    url: "/"
  }));
}

/** A proposal nobody answered in time: the original stays; the provider is told to call, the client that nothing changed. */
export function noticeProposalLapsed({ providerUserId, clientUserId, booking, clientName, provider }) {
  if (providerUserId) {
    void quiet(sendPushToUser(Number(providerUserId), {
      title: "مشتری به پیشنهاد جواب نداد",
      body: `${clientName || "مشتری"}، ${booking.service || "نوبت"}: ساعت و آرتیست قبلی سر جاشه. بهش زنگ بزن.`,
      url: "/"
    }));
  }
  if (clientUserId) {
    // Owner's wording of 2026-10-25: «پیشنهاد سالن رز تموم شد. نوبتت همون شنبه ساعت ۱۰ سر جاشه.» (push and card line, no SMS)
    void quiet(sendPushToUser(Number(clientUserId), {
      title: `پیشنهاد ${providerLabel(provider?.type, provider?.name)} تموم شد`,
      body: proposalLapsedClientText(booking),
      url: "/"
    }));
  }
}
