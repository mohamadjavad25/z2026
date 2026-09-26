"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, History } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { BookingSelect } from "../../components/BookingSelect";
import { BreakTimeWheel } from "../../components/BreakTimeWheel";

export function BookingCreateForm({
  role = "salon",
  onSubmit,
  customerOptions = [],
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
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [nameQuery, setNameQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const normalizedQuery = nameQuery.trim();
  const matchingCustomers = normalizedQuery
    ? customerOptions
      .filter((item) => item.name && item.name.includes(normalizedQuery))
      .slice(0, 5)
    : [];

  useEffect(() => {
    if (!suggestOpen) return undefined;
    const handleOutside = (event) => {
      if (suggestBoxRef.current && !suggestBoxRef.current.contains(event.target)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [suggestOpen]);

  function applyCustomer(customer) {
    if (nameInputRef.current) nameInputRef.current.value = customer.name;
    if (phoneInputRef.current) phoneInputRef.current.value = customer.phone || "";
    setNameQuery(customer.name);
    setSuggestOpen(false);
  }
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
      <label className="bookingClientLookup" ref={suggestBoxRef}>
        <input
          ref={nameInputRef}
          name="client"
          placeholder="نام مشتری"
          aria-label="نام مشتری"
          autoComplete="name"
          defaultValue=""
          required
          onChange={(event) => {
            setNameQuery(event.target.value);
            setSuggestOpen(true);
          }}
          onFocus={() => setSuggestOpen(true)}
        />
        {suggestOpen && matchingCustomers.length ? (
          <div className="bookingClientSuggestList" role="listbox" aria-label="مشتریان قبلی">
            {matchingCustomers.map((customer) => (
              <button
                type="button"
                key={customer.key}
                role="option"
                className="bookingClientSuggestItem"
                onClick={() => applyCustomer(customer)}
              >
                <History size={13} aria-hidden="true" />
                <span>
                  <b>{customer.name}</b>
                  <small>
                    {customer.phone ? toPersianDigits(customer.phone) : "شماره ثبت نشده"}
                    {customer.lastService ? ` · ${customer.lastService}` : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </label>
      <label>
        <input
          ref={phoneInputRef}
          name="phone"
          placeholder="شماره تماس (اختیاری)"
          aria-label="شماره تماس"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          maxLength={11}
        />
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
      {!isBusy && (submitDisabled || !serviceValue || !timeOptions.length) ? (
        <p className="bookingCreateDisabledHint">
          {submitDisabled
            ? "ابتدا حداقل یک خدمت به پروفایلت اضافه کن."
            : !serviceValue
              ? "برای ثبت، ابتدا خدمت را انتخاب کن."
              : "برای این روز نوبت آزادی نیست."}
        </p>
      ) : null}
    </form>
  );
}
