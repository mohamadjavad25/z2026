import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { formatTomanNumber, parseTomanAmount } from "../../../shared/lib/money";
import { toPersianDigits } from "../../../shared/lib/digits";
import { buildInviteSmsHref } from "../../../shared/lib/inviteSms";
import { BookingSheet } from "../../profile/BookingSheet";
import { BookingCreateForm } from "../../profile/BookingCreateForm";
import { ProfileSheet } from "../../profile/ProfileSheet";

import { useHome } from "../HomeContext";

/** The text the owner sends a customer they booked from their contacts. */
function buildBookingSmsText({ client, service, day, time, owner }) {
  const who = client ? `سلام ${client}،` : "سلام،";
  const where = owner ? ` در «${owner}»` : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${who} نوبت «${service}» شما${where} برای ${day} ساعت ${toPersianDigits(time)} ثبت شد.${origin ? ` frfro: ${origin}` : ""}`;
}

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
    setBookingSelectMenu,
    bookingPrefill
  } = useHome();
  // A booking made for a contact, waiting to be texted to them: { client, phone, text }.
  const [sendTo, setSendTo] = useState(null);
  const isArtist = createdProfile?.type === "artist";
  const dayOptions = isArtist ? artistBookingDayOptions : salonBookingDayOptions;

  async function handleSubmit(event) {
    // Read the form before the handler resets it; only a booking started from the contacts gets the "send" step.
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const fromContact = Boolean(bookingPrefill);
    const saved = isArtist
      ? await handleArtistBookingCreate(event)
      : await addSalonAppointment(event, { bookingDateForSlots, selectedBookingStaff });
    if (!saved || !fromContact) return;
    const client = String(data.client || "").trim();
    const day = String(data[isArtist ? "date" : "booking_date"] || "");
    const text = buildBookingSmsText({
      client,
      service: String(data.service || "").trim(),
      day: dayOptions.find((option) => option.value === day)?.label || day,
      time: String(data.time || ""),
      owner: String(createdProfile?.data?.name || "").trim()
    });
    const href = buildInviteSmsHref(data.phone, text);
    if (href) setSendTo({ client, href });
  }

  return (
    <>
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
            initialName={bookingPrefill?.name || ""}
            initialPhone={bookingPrefill?.phone || ""}
            onSubmit={handleSubmit}
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
              label: person.is_owner ? `${person.name} (خودم)` : person.name,
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
    <ProfileSheet
      open={Boolean(sendTo)}
      kicker=""
      title="رزرو ثبت شد"
      panelClassName="bookingSendSheet"
      onClose={() => setSendTo(null)}
    >
      <div className="bookingSendBody">
        <p>نوبت را برای {sendTo?.client || "مشتری"} بفرست تا روز و ساعتش را داشته باشد.</p>
        <a className="cnScanCustomerBtn" href={sendTo?.href || undefined} onClick={() => setTimeout(() => setSendTo(null), 0)}>
          <MessageSquareText size={17} aria-hidden="true" />
          ارسال پیامک به {sendTo?.client || "مشتری"}
        </a>
        <button type="button" className="bookingSendLater" onClick={() => setSendTo(null)}>بعداً</button>
      </div>
    </ProfileSheet>
    </>
  );
}
