import { useCallback, useRef, useState } from "react";
import { createSalonBooking, updateSalonBooking } from "../../shared/api/salons";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import { markNoShow, withdrawProposal } from "../../shared/api/providerExit";

/**
 * What the salon owner does with a booking: write one from the booking form, change or cancel one from the
 * schedule menu, and answer a client's request (confirm, decline). Part of useSalonWorkspace, which keeps the
 * booking list itself and hands in how to apply a fresh list.
 */
export function useSalonBookingActions({
  shellNotify,
  notify,
  onScheduleViewDay,
  onLinkedArtistBooked,
  onCloseBookingSheet,
  applySalonBookings,
  refreshSalonBookingsLive,
  salonBookingsEpochRef,
  salonRequestBusyIdRef,
  setSalonRequestBusyId,
  setSalonAppointmentList,
  setSalonToolSheetOpen
}) {
  const salonBookingSubmittingRef = useRef(false);
  const [scheduleBookingBusy, setScheduleBookingBusy] = useState(false);
  const scheduleBookingBusyRef = useRef(false);

/**
   * The salon's own booking from the booking form (VisitBooker): one service or several back to back,
   * with an artist per service when the salon named them. Resolves { ok, status, payload } so the form
   * can say what went wrong; nothing here toasts a failure (the form shows it where the person is looking).
   */
  const submitSalonVisit = useCallback(async (body) => {
    if (salonBookingSubmittingRef.current) return { ok: false, status: 0, payload: { error: "نوبت قبلی داره ثبت می‌شه؛ یه لحظه صبر کن." } };
    salonBookingSubmittingRef.current = true;
    try {
      const { ok, status, payload } = await createSalonBooking({ ...body, status: "تازه" });
      if (!ok) {
        applySalonBookings(payload?.data?.bookings, { bump: true });
        return { ok: false, status, payload };
      }
      salonBookingsEpochRef.current += 1;
      const nextBookings = Array.isArray(payload.data?.bookings) ? payload.data.bookings : null;
      if (nextBookings) {
        setSalonAppointmentList(nextBookings);
      } else if (payload.data?.booking) {
        setSalonAppointmentList((list) => (
          list.some((item) => String(item.id) === String(payload.data.booking.id)) ? list : [payload.data.booking, ...list]
        ));
      }
      if (typeof onScheduleViewDay === "function") {
        onScheduleViewDay(payload.data?.booking?.booking_date || body.bookingDate);
      }
      const linkedArtistIds = payload.data?.linkedArtistIds?.length
        ? payload.data.linkedArtistIds
        : [payload.data?.linkedArtistId].filter(Boolean);
      shellNotify(linkedArtistIds.length
        ? "نوبت ثبت شد و آرتیست هم خبردار شد."
        : "نوبت ثبت شد؛ آرتیستش حساب فرفرو نداره، خودت خبرش کن.");
      notify("نوبت ثبت شد!");
      setSalonToolSheetOpen(false);
      if (typeof onLinkedArtistBooked === "function") {
        for (const linkedArtistId of linkedArtistIds) {
          try {
            await onLinkedArtistBooked(linkedArtistId);
          } catch {
            // the artist's refresh is best effort; the salon booking is already in
          }
        }
      }
      if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
      void refreshSalonBookingsLive(salonBookingsEpochRef.current);
      return { ok: true, status, payload };
    } catch {
      return { ok: false, status: 0, payload: {} };
    } finally {
      salonBookingSubmittingRef.current = false;
    }
  }, [shellNotify, notify, onScheduleViewDay, onLinkedArtistBooked, onCloseBookingSheet, applySalonBookings, refreshSalonBookingsLive]);

  /**
   * Owner update/cancel for a single booking. Returns a boolean so HomeApp's thin wrappers
   * (changeScheduleBookingTime/Staff, cancelScheduleBooking) can close scheduleBookingMenu
   * themselves on success — the schedule menu is HomeApp-owned state.
   */
  const patchSalonAppointment = useCallback(async (booking, patch, notice) => {
    if (!booking?.id) {
      shellNotify("این نوبت رو دیگه نمی‌شه عوض کرد.");
      return false;
    }
    if (scheduleBookingBusyRef.current) return false;
    scheduleBookingBusyRef.current = true;
    setScheduleBookingBusy(true);
    try {
      // `withdrawProposal`: the salon takes back its «پیشنهاد ساعت دیگر» (DELETE /api/booking-proposals).
      // `noShow`: «نیومد» on a booking that has started, or taking it back (POST /api/booking-no-show).
      const { ok, payload } = patch?.withdrawProposal
        ? await withdrawProposal({ kind: "salon", id: booking.id })
        : typeof patch?.noShow === "boolean"
          ? await markNoShow({ kind: "salon", id: booking.id, noShow: patch.noShow })
          : await updateSalonBooking({ id: booking.id, ...patch });
      if (!ok) {
        if (Array.isArray(payload.data?.bookings)) applySalonBookings(payload.data.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "نوبت ذخیره نشد؛ دوباره بزن."));
        return false;
      }
      applySalonBookings(payload.data?.bookings || [], { bump: true });
      const notifyIds = Array.isArray(payload.data?.linkedArtistIds) && payload.data.linkedArtistIds.length
        ? payload.data.linkedArtistIds
        : (payload.data?.linkedArtistId ? [payload.data.linkedArtistId] : []);
      if (typeof onLinkedArtistBooked === "function") {
        for (const artistId of notifyIds) {
          onLinkedArtistBooked(artistId);
        }
      }
      if (notice) shellNotify(notice);
      return true;
    } catch {
      shellNotify("نوبت ذخیره نشد؛ دوباره بزن.");
      return false;
    } finally {
      scheduleBookingBusyRef.current = false;
      setScheduleBookingBusy(false);
    }
  }, [shellNotify, applySalonBookings, onLinkedArtistBooked]);

  /**
   * Confirms a REAL pending `salon_bookings` row (status "درخواست") in place
   * via PATCH /api/salon-bookings — the same route/repo function
   * (patchSalonBookingWithArtistSync) every other owner booking edit here
   * uses (see patchSalonAppointment above). This used to fabricate a brand
   * new booking from fake mock data instead of touching the real pending
   * row at all; that bug is why the salon's notification bell could show 0
   * while real "درخواست" bookings sat unresolved in the DB forever.
   */
  const approveReservationRequest = useCallback(async (requestId) => {
    if (salonRequestBusyIdRef.current) return;
    const busyKey = `reservation:${requestId}`;
    salonRequestBusyIdRef.current = busyKey;
    setSalonRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateSalonBooking({ id: requestId, status: "تایید شده" });
      if (!ok) {
        if (Array.isArray(payload.data?.bookings)) applySalonBookings(payload.data.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "تأیید نشد؛ دوباره بزن."));
        return;
      }
      applySalonBookings(payload.data?.bookings || [], { bump: true });
      if (typeof onScheduleViewDay === "function" && payload.data?.booking?.booking_date) {
        onScheduleViewDay(payload.data.booking.booking_date);
      }
      const notifyIds = Array.isArray(payload.data?.linkedArtistIds) && payload.data.linkedArtistIds.length
        ? payload.data.linkedArtistIds
        : (payload.data?.linkedArtistId ? [payload.data.linkedArtistId] : []);
      if (typeof onLinkedArtistBooked === "function") {
        for (const artistId of notifyIds) onLinkedArtistBooked(artistId);
      }
      shellNotify("تأیید شد؛ مشتری خبردار شد.");
      await refreshSalonBookingsLive(salonBookingsEpochRef.current);
    } catch {
      shellNotify("تأیید نشد؛ دوباره بزن.");
    } finally {
      salonRequestBusyIdRef.current = "";
      setSalonRequestBusyId("");
    }
  }, [shellNotify, onScheduleViewDay, onLinkedArtistBooked, applySalonBookings, refreshSalonBookingsLive]);

  /**
   * Rejects a REAL pending `salon_bookings` row by cancelling it — the exact
   * same cancel path (`status: "لغو"`, `action: "cancel"`) used by the
   * schedule menu's owner-initiated cancel (see useScheduleBookingMenu.js /
   * patchSalonAppointment), not a second cancel mechanism. Used to only
   * drop a fake mock item from local state with no DB write at all.
   */
  const declineReservationRequest = useCallback(async (requestId) => {
    if (salonRequestBusyIdRef.current) return;
    const busyKey = `reservation:${requestId}`;
    salonRequestBusyIdRef.current = busyKey;
    setSalonRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateSalonBooking({ id: requestId, status: "لغو", action: "cancel" });
      if (!ok) {
        if (Array.isArray(payload.data?.bookings)) applySalonBookings(payload.data.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "رد نشد؛ دوباره بزن."));
        return;
      }
      applySalonBookings(payload.data?.bookings || [], { bump: true });
      const notifyIds = Array.isArray(payload.data?.linkedArtistIds) && payload.data.linkedArtistIds.length
        ? payload.data.linkedArtistIds
        : (payload.data?.linkedArtistId ? [payload.data.linkedArtistId] : []);
      if (typeof onLinkedArtistBooked === "function") {
        for (const artistId of notifyIds) onLinkedArtistBooked(artistId);
      }
      shellNotify("رد شد؛ مشتری خبردار شد.");
    } catch {
      shellNotify("رد نشد؛ دوباره بزن.");
    } finally {
      salonRequestBusyIdRef.current = "";
      setSalonRequestBusyId("");
    }
  }, [shellNotify, applySalonBookings, onLinkedArtistBooked]);

  return {
    scheduleBookingBusy,
    submitSalonVisit,
    patchSalonAppointment,
    approveReservationRequest,
    declineReservationRequest
  };
}
