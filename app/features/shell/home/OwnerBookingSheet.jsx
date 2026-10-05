import { formatTomanNumber, parseTomanAmount } from "../../../shared/lib/money";
import { BookingSheet } from "../../profile/BookingSheet";
import { BookingCreateForm } from "../../profile/BookingCreateForm";

export function OwnerBookingSheet({
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
  selectedBookingStaff,
  setBookingStaffName,
  artistBookingDayOptions,
  salonScheduleWeekTabs,
  artistBookingDateForSlots,
  bookingDateForSlots,
  setBookingDate,
  artistBookingFreeSlots,
  bookingFreeSlots,
  bookingTime,
  setBookingTime,
  artistBookingSubmitting,
  salonBookingSubmitting,
  salonServiceList,
  openArtistServiceCreate,
  openSalonServiceCreate,
  addSalonAppointment,
  handleArtistBookingCreate,
  setBookingSelectMenu,
  salonHoursList
}) {
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
            staffValue={selectedBookingStaff}
            staffMenuOpen={bookingSelectMenu === "staff"}
            onStaffMenuOpenChange={(next) => setBookingSelectMenu(next ? "staff" : "")}
            onStaffChange={setBookingStaffName}
            dayOptions={
              createdProfile?.type === "artist"
                ? artistBookingDayOptions
                : salonScheduleWeekTabs
                  // A booking can only ever be created for today or later --
                  // this same tab list is shared with the schedule-browsing
                  // view (which legitimately looks a few days into the
                  // past), so the past-date exclusion belongs here, not on
                  // salonScheduleWeekTabs itself.
                  .filter((tab) => (tab.offset ?? 0) >= 0)
                  .filter((tab) => {
                    const hour = salonHoursList.find((item) => item.day === tab.day);
                    return hour ? Boolean(hour.active) : true;
                  })
                  .map((tab) => ({
                    value: tab.dateKey,
                    label: `${tab.label} ${tab.sub || ""}`.trim()
                  }))
            }
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
