"use client";

import { CalendarCheck } from "lucide-react";
import { BookingSelect } from "../../components/BookingSelect";
import { BreakTimeWheel } from "../../components/BreakTimeWheel";

export function BookingCreateForm({
  role = "salon",
  onSubmit,
  serviceOptions = [],
  serviceValue = "",
  serviceMenuOpen = false,
  onServiceMenuOpenChange,
  onServiceChange,
  staffOptions = [],
  staffValue = "",
  staffMenuOpen = false,
  onStaffMenuOpenChange,
  onStaffChange,
  dayOptions = [],
  dayValue = "",
  onDayChange,
  timeOptions = [],
  timeValue = "",
  onTimeChange,
  submitDisabled = false,
  submitting = false
}) {
  const showStaff = role === "salon";
  const dayFieldName = role === "salon" ? "booking_date" : "date";
  const isBusy = Boolean(submitting);
  const normalizedDayOptions = dayOptions.map((option) => (
    option && typeof option === "object"
      ? {
        value: String(option.value ?? option.day ?? option.label ?? ""),
        label: String(option.label ?? option.day ?? option.value ?? "")
      }
      : { value: String(option || ""), label: String(option || "") }
  )).filter((option) => option.value && option.label);
  const activeDayOption = normalizedDayOptions.find((option) => option.value === dayValue)
    || normalizedDayOptions.find((option) => option.label === dayValue)
    || normalizedDayOptions[0]
    || { value: dayValue, label: dayValue };
  const dayLabels = normalizedDayOptions.map((option) => option.label);

  return (
    <form
      className="bookingFormGrid bookingCreateForm is-flat"
      onSubmit={onSubmit}
    >
      <label>
        <input name="client" placeholder="نام مشتری" autoComplete="name" required />
      </label>
      <label>
        <input name="phone" placeholder="شماره تماس (اختیاری)" inputMode="tel" autoComplete="tel" dir="ltr" />
      </label>

      <div className={`bookingHalfField ${showStaff ? "" : "is-wide"}`.trim()}>
        <BookingSelect
          label="خدمت"
          name="service"
          value={serviceValue}
          open={serviceMenuOpen}
          onOpenChange={onServiceMenuOpenChange}
          onChange={onServiceChange}
          options={serviceOptions}
        />
      </div>

      {showStaff ? (
        <div className="bookingHalfField">
          <BookingSelect
            label="پرسنل"
            name="staff"
            value={staffValue}
            open={staffMenuOpen}
            onOpenChange={onStaffMenuOpenChange}
            onChange={onStaffChange}
            options={staffOptions}
          />
        </div>
      ) : null}

      <div className="artistPublicBookingWheels bookingCreateWheels">
        <div className="artistPublicBookingDayPicker">
          <span>روز</span>
          <input type="hidden" name={dayFieldName} value={activeDayOption.value} />
          <BreakTimeWheel
            mode="label"
            idPrefix="booking-day"
            visibleCount={5}
            itemSize={38}
            options={dayLabels}
            value={activeDayOption.label}
            onChange={(label) => {
              const option = normalizedDayOptions.find((item) => item.label === label);
              onDayChange?.(option?.value || label);
            }}
            ariaLabel="انتخاب روز رزرو"
            activeColor="#5d43b5"
            inactiveColor="rgba(20, 22, 30, 0.82)"
          />
        </div>
        <div className="artistPublicBookingTimePicker">
          <span>ساعت</span>
          <input type="hidden" name="time" value={timeValue} />
          {timeOptions.length ? (
            <BreakTimeWheel
              mode="clock"
              idPrefix="booking-time"
              visibleCount={5}
              itemSize={38}
              options={timeOptions}
              value={timeValue}
              onChange={onTimeChange}
              ariaLabel="انتخاب ساعت رزرو"
              activeColor="#5d43b5"
              inactiveColor="rgba(20, 22, 30, 0.82)"
            />
          ) : (
            <div className="artistPublicSlotEmpty">
              نوبت آزادی نیست
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="bookingPrimaryBtn"
        disabled={submitDisabled || isBusy || !serviceValue || !timeOptions.length}
      >
        <CalendarCheck size={15} />
        {isBusy ? "در حال ثبت..." : "ثبت رزرو"}
      </button>
    </form>
  );
}
