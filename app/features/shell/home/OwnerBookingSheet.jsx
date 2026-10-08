import { formatTomanNumber, parseTomanAmount } from "../../../shared/lib/money";
import { BookingSheet } from "../../profile/BookingSheet";
import { BookingCreateForm } from "../../profile/BookingCreateForm";

import { useHome } from "../HomeContext";
export function OwnerBookingSheet() {
  const {
    bookingSheetOpen,
    createdProfile,
    closeBookingSheet,
    bookingCustomerOptions,
    artistServiceList,
    bookingServiceOptions,
    bookingServiceName,
    selectedBookingService,
    bookingSelectMenu,
    setBookingServiceName,
    bookingStaffOptions,
    bookingStaffName,
    selectedBookingStaff,
    setBookingStaffName,
    artistBookingDayOptions,
    artistBookingDateForSlots,
    bookingDateForSlots,
    setBookingDate,
    artistBookingFreeSlots,
    bookingFreeSlots,
    bookingStaffForTime,
    salonBookingDayOptions,
    bookingTime,
    setBookingTime,
    artistBookingSubmitting,
    salonBookingSubmitting,
    salonServiceList,
    openArtistServiceCreate,
    openSalonServiceCreate,
    addSalonAppointment,
    handleArtistBookingCreate,
    setBookingSelectMenu
  } = useHome();

  return (
    <BookingSheet
          open={bookingSheetOpen && (createdProfile?.type === "salon" || createdProfile?.type === "artist")}
          role={createdProfile?.type === "artist" ? "artist" : "salon"}
          title="ایجاد رزرو"
          onClose={closeBookingSheet}
        >
          <BookingCreateForm
            role={createdProfile?.type === "artist" ? "artist" : "salon"}
            customerOptions={bookingCustomerOptions}
            onAddService={() => {
              closeBookingSheet();
              if (createdProfile?.type === "artist") openArtistServiceCreate();
              else openSalonServiceCreate();
            }}
            onSubmit={(event) => {
              if (createdProfile?.type === "artist") {
                handleArtistBookingCreate(event);
                return;
              }
              addSalonAppointment(event, { bookingDateForSlots, selectedBookingStaff });
            }}
            serviceOptions={(createdProfile?.type === "artist" ? artistServiceList : bookingServiceOptions).map((item) => ({
              value: item.name,
              label: item.name,
              emoji: item.emoji,
              withIcon: true,
              meta: [item.price ? `${formatTomanNumber(parseTomanAmount(item.price))} تومان` : "", item.duration].filter(Boolean).join(" • ")
            }))}
            serviceValue={
              createdProfile?.type === "artist"
                ? (bookingServiceName || artistServiceList[0]?.name || "")
                : (selectedBookingService?.name || "")
            }
            serviceMenuOpen={bookingSelectMenu === "service"}
            onServiceMenuOpenChange={(next) => setBookingSelectMenu(next ? "service" : "")}
            onServiceChange={setBookingServiceName}
            staffOptions={bookingStaffOptions.map((person) => ({
              value: person.name,
              label: person.name,
              meta: person.role || ""
            }))}
            staffValue={bookingStaffName}
            staffForTime={bookingStaffForTime}
            staffMenuOpen={bookingSelectMenu === "staff"}
            onStaffMenuOpenChange={(next) => setBookingSelectMenu(next ? "staff" : "")}
            onStaffChange={setBookingStaffName}
            dayOptions={createdProfile?.type === "artist" ? artistBookingDayOptions : salonBookingDayOptions}
            dayValue={createdProfile?.type === "artist" ? artistBookingDateForSlots : bookingDateForSlots}
            onDayChange={setBookingDate}
            timeOptions={createdProfile?.type === "artist" ? artistBookingFreeSlots : bookingFreeSlots}
            timeValue={bookingTime}
            onTimeChange={setBookingTime}
            submitting={
              createdProfile?.type === "artist"
                ? artistBookingSubmitting
                : salonBookingSubmitting
            }
            submitDisabled={
              createdProfile?.type === "artist"
                ? !artistServiceList.length
                : !salonServiceList.length
            }
          />
        </BookingSheet>
  );
}
