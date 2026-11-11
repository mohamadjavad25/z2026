import { useCallback, useRef, useState } from "react";
import { updateArtistBooking } from "../../shared/api/artists";
import { markNoShow, proposeArtistTime, withdrawProposal } from "../../shared/api/providerExit";
import { toPersianDigits } from "../../shared/lib/digits";
import { mapArtistBooking } from "./bookingUtils";

/**
 * The artist's answers to her own direct bookings: confirm or decline a request, and on a confirmed one «نیومد»,
 * another time, taking that back, or cancelling. One at a time (the busy id). Part of useArtistWorkspace.
 */
export function useArtistBookingAnswers({ shellNotify, setArtistBookingList }) {
  const [artistRequestBusyId, setArtistRequestBusyId] = useState("");
  const artistRequestBusyIdRef = useRef("");

  /**
   * Confirms a REAL pending direct artist_bookings row (status "تازه") via
   * PATCH /api/artist/me — mirrors approveReservationRequest in
   * useSalonWorkspace.js exactly (same optimistic-list-replace shape),
   * for the direct-artist-booking equivalent of that salon flow.
   */
  const confirmArtistBookingRequest = useCallback(async (bookingId) => {
    if (artistRequestBusyIdRef.current) return;
    const busyKey = `booking:${bookingId}`;
    artistRequestBusyIdRef.current = busyKey;
    setArtistRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateArtistBooking({ id: bookingId, status: "تایید شده" });
      if (!ok) {
        shellNotify(payload?.error || "تأیید نشد؛ دوباره بزن.");
        return;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify("تأیید شد؛ مشتری خبردار شد.");
    } catch {
      shellNotify("تأیید نشد؛ دوباره بزن.");
    } finally {
      artistRequestBusyIdRef.current = "";
      setArtistRequestBusyId("");
    }
  }, [shellNotify]);

  /**
   * Declines (cancels) a REAL pending direct artist_bookings row — mirrors
   * declineReservationRequest in useSalonWorkspace.js, same cancel path
   * (status "لغو", action "cancel") PATCH /api/artist/me now supports.
   */
  const declineArtistBookingRequest = useCallback(async (bookingId) => {
    if (artistRequestBusyIdRef.current) return;
    const busyKey = `booking:${bookingId}`;
    artistRequestBusyIdRef.current = busyKey;
    setArtistRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateArtistBooking({ id: bookingId, status: "لغو", action: "cancel" });
      if (!ok) {
        shellNotify(payload?.error || "رد نشد؛ دوباره بزن.");
        return;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify("رد شد؛ مشتری خبردار شد.");
    } catch {
      shellNotify("رد نشد؛ دوباره بزن.");
    } finally {
      artistRequestBusyIdRef.current = "";
      setArtistRequestBusyId("");
    }
  }, [shellNotify]);

  /**
   * One change to the artist's own confirmed direct booking from its screen: «نیومد», «پیشنهاد ساعت دیگه», taking the
   * proposal back, or cancelling with notice. The list comes back from the server; true when it went through.
   */
  const runArtistBookingCall = useCallback(async (bookingId, call, notice) => {
    if (artistRequestBusyIdRef.current) return false;
    const busyKey = `booking:${bookingId}`;
    artistRequestBusyIdRef.current = busyKey;
    setArtistRequestBusyId(busyKey);
    try {
      const { ok, payload } = await call();
      if (!ok) {
        shellNotify(payload?.error || "نشد؛ دوباره بزن.");
        return false;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify(notice);
      return true;
    } catch {
      shellNotify("نشد؛ دوباره بزن.");
      return false;
    } finally {
      artistRequestBusyIdRef.current = "";
      setArtistRequestBusyId("");
    }
  }, [shellNotify]);

  const markArtistNoShow = useCallback((bookingId, noShow) => runArtistBookingCall(
    bookingId,
    () => markNoShow({ kind: "artist", id: bookingId, noShow }),
    noShow ? "زدی که نیومد." : "برگشت؛ دیگه «نیومد» نیست."
  ), [runArtistBookingCall]);

  const proposeArtistBookingTime = useCallback((bookingId, time) => runArtistBookingCall(
    bookingId,
    () => proposeArtistTime({ id: bookingId, time }),
    `ساعت ${toPersianDigits(time)} رو به مشتری پیشنهاد دادیم. تا قبول نکنه، نوبت همون ساعت قبلی می‌مونه.`
  ), [runArtistBookingCall]);

  const withdrawArtistProposal = useCallback((bookingId) => runArtistBookingCall(
    bookingId,
    () => withdrawProposal({ kind: "artist", id: bookingId }),
    "پیشنهاد رو پس گرفتی؛ نوبت همون ساعت قبلیه."
  ), [runArtistBookingCall]);

  const cancelArtistConfirmedBooking = useCallback((bookingId) => runArtistBookingCall(
    bookingId,
    () => updateArtistBooking({ id: bookingId, status: "لغو", action: "cancel" }),
    "نوبت لغو شد؛ مشتری خبردار شد."
  ), [runArtistBookingCall]);

  return {
    artistRequestBusyId,
    confirmArtistBookingRequest,
    declineArtistBookingRequest,
    markArtistNoShow,
    proposeArtistBookingTime,
    withdrawArtistProposal,
    cancelArtistConfirmedBooking
  };
}
