"use client";

import { ScheduleBookingMenuModal } from "../../schedule";
import { useHome } from "../HomeContext";

export function ScheduleMenuHost() {
  const {
    scheduleBookingMenu,
    createdProfile,
    scheduleBookingView,
    setScheduleBookingView,
    safeSalonStaffList,
    bookingStaffOptions,
    closeScheduleBookingMenu,
    changeScheduleBookingTime,
    changeScheduleBookingStaff,
    changeScheduleBookingParts,
    cancelScheduleBooking,
    scheduleBookingBusy,
    approveReservationRequest,
    confirmArtistBookingRequest,
    declineReservationRequest,
    declineArtistBookingRequest
  } = useHome();

  return (
    <ScheduleBookingMenuModal
          open={Boolean(
            scheduleBookingMenu
            && (createdProfile?.type === "salon" || createdProfile?.type === "artist")
          )}
          booking={scheduleBookingMenu}
          view={scheduleBookingView}
          onViewChange={setScheduleBookingView}
          staffOptions={safeSalonStaffList.length ? safeSalonStaffList : bookingStaffOptions}
          onClose={closeScheduleBookingMenu}
          onChangeTime={changeScheduleBookingTime}
          onChangeStaff={changeScheduleBookingStaff}
          onChangeParts={changeScheduleBookingParts}
          onCancel={cancelScheduleBooking}
          onApprove={async () => {
            if (!scheduleBookingMenu) return;
            if (scheduleBookingMenu.ownerType === "salon") {
              await approveReservationRequest(scheduleBookingMenu.id);
            } else {
              await confirmArtistBookingRequest(scheduleBookingMenu.id);
            }
            closeScheduleBookingMenu();
          }}
          onDecline={async () => {
            if (!scheduleBookingMenu) return;
            if (scheduleBookingMenu.ownerType === "salon") {
              await declineReservationRequest(scheduleBookingMenu.id);
            } else {
              await declineArtistBookingRequest(scheduleBookingMenu.id);
            }
            closeScheduleBookingMenu();
          }}
          busy={scheduleBookingBusy}
        />
  );
}
