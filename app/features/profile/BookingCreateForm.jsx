"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, History, Plus } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { BookingSelect } from "../../components/BookingSelect";

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
  submitting = false,
  onAddService
}) {
  const showStaff = role === "salon";
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [nameQuery, setNameQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const normalizedQuery = nameQuery.trim();
  // Empty query -> most recent customers (customerOptions already arrives
  // newest-visit-first, see buildBookingCustomers), so focusing the empty
  // field surfaces last-visit suggestions immediately instead of only
  // reacting once the owner starts typing a matching name.
  const matchingCustomers = (
    normalizedQuery
      ? customerOptions.filter((item) => item.name && item.name.includes(normalizedQuery))
      : customerOptions
  ).slice(0, 5);

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
  // Day/time are no longer picked by hand here -- the owner just books
  // "now" (booking_date/time still get submitted, auto-managed by
  // useBookingCreateSheet's own nearest-free-slot logic, the same as
  // before whenever the wheel's value fell outside the free slots).
  const normalizedDayOptions = dayOptions.map((option) => (
    option && typeof option === "object"
      ? {
        value: String(option.value ?? option.day ?? option.label ?? ""),
        label: String(option.label ?? option.day ?? option.value ?? "")
      }
      : { value: String(option || ""), label: String(option || "") }
  )).filter((option) => option.value && option.label);
  const activeDayValue = (
    normalizedDayOptions.find((option) => option.value === dayValue)
    || normalizedDayOptions.find((option) => option.label === dayValue)
    || normalizedDayOptions[0]
    || { value: dayValue }
  ).value;

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

      <input type="hidden" name={dayFieldName} value={activeDayValue} />
      <input type="hidden" name="time" value={timeValue} />

      <button
        type="submit"
        className="bookingPrimaryBtn"
        disabled={submitDisabled || isBusy || !serviceValue || !timeOptions.length}
      >
        <CalendarCheck size={15} />
        {isBusy ? "در حال ثبت..." : "ثبت رزرو"}
      </button>
      {!isBusy && submitDisabled ? (
        <button
          type="button"
          className="bookingCreateAddServiceBtn"
          onClick={onAddService}
        >
          <Plus size={14} />
          ابتدا یک خدمت به پروفایلت اضافه کن
        </button>
      ) : !isBusy && (!serviceValue || !timeOptions.length) ? (
        <p className="bookingCreateDisabledHint">
          {!serviceValue
            ? "برای ثبت، ابتدا خدمت را انتخاب کن."
            : "برای این روز نوبت آزادی نیست."}
        </p>
      ) : null}
    </form>
  );
}
