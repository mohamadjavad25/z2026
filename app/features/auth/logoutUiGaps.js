/**
 * Shell/UI logout gaps that were forgotten in domain resets.
 * Intentionally does NOT clear salonDirectory, reservationRequestList, or frfru_last_phone.
 */
export function createLogoutUiGapResets(setters) {
  const {
    setBookingSheetOpen,
    setScheduleBookingMenu,
    setScheduleBookingView,
    setClientBookingSettings,
    setArtistServiceCreateOpen,
    setArtistServiceCreateMode,
    setArtistServiceDraft,
    setBookingStaffName,
    setBookingServiceName,
    setBookingDate,
    setBookingTime,
    setBookingSelectMenu
  } = setters;

  return function resetLogoutUiGaps() {
    setBookingSheetOpen?.(false);
    setScheduleBookingMenu?.(null);
    setScheduleBookingView?.("menu");
    setClientBookingSettings?.(null);
    setArtistServiceCreateOpen?.(false);
    setArtistServiceCreateMode?.("preset");
    setArtistServiceDraft?.({
      id: null,
      name: "",
      price: "",
      duration: "۶۰ دقیقه",
      hint: ""
    });
    setBookingStaffName?.("");
    setBookingServiceName?.("");
    setBookingDate?.("");
    setBookingTime?.("۱۸:۳۰");
    setBookingSelectMenu?.("");
  };
}

/** Snapshot of expected post-logout UI gap values (for isolated tests). */
export const LOGOUT_UI_GAP_DEFAULTS = {
  bookingSheetOpen: false,
  scheduleBookingMenu: null,
  scheduleBookingView: "menu",
  clientBookingSettings: null,
  artistServiceCreateOpen: false,
  artistServiceCreateMode: "preset",
  artistServiceDraft: {
    id: null,
    name: "",
    price: "",
    duration: "۶۰ دقیقه",
    hint: ""
  },
  bookingStaffName: "",
  bookingServiceName: "",
  bookingDate: "",
  bookingTime: "۱۸:۳۰",
  bookingSelectMenu: "",
  profileType: "client",
  authNotice: ""
};
