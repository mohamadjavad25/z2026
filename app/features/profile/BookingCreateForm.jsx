"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceIcon } from "../../components/ServiceIcon";

const normalizeOption = (option) => (
  option && typeof option === "object"
    ? {
      value: String(option.value ?? option.day ?? option.label ?? ""),
      label: String(option.label ?? option.day ?? option.value ?? "")
    }
    : { value: String(option || ""), label: String(option || "") }
);

/**
 * Owner's "new booking" form (salon + artist). Everything is a tap: pick or
 * type the customer, tap a service, tap a day, tap a free time. The first free
 * time is chosen for you, so a walk-in is usually name -> service -> save.
 * The native FormData contract is unchanged (client, phone, service, staff,
 * day field, time) so both submit handlers keep working as they were.
 */
export function BookingCreateForm({
  role = "salon",
  onSubmit,
  customerOptions = [],
  serviceOptions = [],
  serviceValue = "",
  onServiceChange,
  staffOptions = [],
  staffValue = "",
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
  const showStaff = role === "salon" && staffOptions.length > 0;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const dayFieldName = role === "salon" ? "booking_date" : "date";
  const isBusy = Boolean(submitting);

  const days = useMemo(() => dayOptions.map(normalizeOption).filter((option) => option.value && option.label), [dayOptions]);
  const activeDay = days.find((option) => option.value === dayValue)
    || days.find((option) => option.label === dayValue)
    || days[0]
    || { value: dayValue, label: dayValue };
  const times = useMemo(() => timeOptions.map(normalizeOption).filter((option) => option.value), [timeOptions]);
  const selectedService = serviceOptions.find((item) => item.value === serviceValue) || serviceOptions[0] || null;
  const selectedTime = times.find((option) => option.value === timeValue) ? timeValue : "";

  // Never leave the time on a slot that isn't free for this day/service: take the first free one.
  useEffect(() => {
    if (times.length && !selectedTime) onTimeChange?.(times[0].value);
  }, [times, selectedTime, onTimeChange]);

  const query = name.trim();
  const suggestions = (
    query
      ? customerOptions.filter((item) => item.name && item.name.includes(query) && item.name !== query)
      : customerOptions
  ).slice(0, 4);

  const noServices = submitDisabled && !serviceOptions.length;
  const canSubmit = !submitDisabled && !isBusy && Boolean(selectedService) && Boolean(selectedTime) && Boolean(query);

  let hint = "";
  if (!isBusy) {
    if (!query) hint = "اسم مشتری را بنویس یا از لیست بالا بزن.";
    else if (!times.length) hint = "برای این روز نوبت آزادی نیست؛ روز دیگری را انتخاب کن.";
  }

  return (
    <form className="bcf" onSubmit={onSubmit}>
      <section className="bcfGroup" aria-labelledby="bcf-customer">
        <h4 id="bcf-customer">مشتری</h4>
        <div className="bcfInputs">
          <input
            name="client"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="نام مشتری"
            aria-label="نام مشتری"
            autoComplete="off"
            required
          />
          <input
            name="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="موبایل (اختیاری)"
            aria-label="شماره تماس"
            inputMode="tel"
            autoComplete="off"
            dir="ltr"
            maxLength={11}
          />
        </div>
        {suggestions.length ? (
          <div className="bcfChips" role="group" aria-label="مشتریان قبلی">
            {suggestions.map((customer) => (
              <button
                type="button"
                key={customer.key}
                className="bcfChip is-person"
                onClick={() => {
                  setName(customer.name);
                  setPhone(customer.phone || "");
                }}
              >
                {customer.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="bcfGroup" aria-labelledby="bcf-service">
        <h4 id="bcf-service">خدمت</h4>
        {noServices ? (
          <button type="button" className="bcfEmpty" onClick={onAddService}>
            <Plus size={16} aria-hidden="true" />
            هنوز خدمتی نداری؛ اولین خدمت را اضافه کن
          </button>
        ) : (
          <>
            <input type="hidden" name="service" value={selectedService?.value || ""} />
            <div className="bcfChips" role="radiogroup" aria-label="انتخاب خدمت">
              {serviceOptions.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  role="radio"
                  aria-checked={selectedService?.value === item.value}
                  className={`bcfChip${selectedService?.value === item.value ? " is-on" : ""}`}
                  onClick={() => onServiceChange?.(item.value)}
                >
                  {item.withIcon ? <ServiceIcon emoji={item.emoji} name={item.label} size="xs" /> : null}
                  {item.label}
                </button>
              ))}
            </div>
            {selectedService?.meta ? <p className="bcfMeta">{selectedService.meta}</p> : null}
          </>
        )}
      </section>

      {showStaff ? (
        <section className="bcfGroup" aria-labelledby="bcf-staff">
          <h4 id="bcf-staff">پرسنل</h4>
          <input type="hidden" name="staff" value={staffValue || staffOptions[0]?.value || ""} />
          <div className="bcfChips" role="radiogroup" aria-label="انتخاب پرسنل">
            {staffOptions.map((person) => (
              <button
                type="button"
                key={person.value}
                role="radio"
                aria-checked={(staffValue || staffOptions[0]?.value) === person.value}
                className={`bcfChip${(staffValue || staffOptions[0]?.value) === person.value ? " is-on" : ""}`}
                onClick={() => onStaffChange?.(person.value)}
              >
                {person.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bcfGroup" aria-labelledby="bcf-when">
        <h4 id="bcf-when">زمان</h4>
        <input type="hidden" name={dayFieldName} value={activeDay.value} />
        <input type="hidden" name="time" value={selectedTime} />
        <div className="bcfDays" role="radiogroup" aria-label="انتخاب روز">
          {days.map((option) => (
            <button
              type="button"
              key={option.value}
              role="radio"
              aria-checked={activeDay.value === option.value}
              className={`bcfDay${activeDay.value === option.value ? " is-on" : ""}`}
              onClick={() => onDayChange?.(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {times.length ? (
          <div className="bcfTimes" role="radiogroup" aria-label="انتخاب ساعت">
            {times.map((option) => (
              <button
                type="button"
                key={option.value}
                role="radio"
                aria-checked={selectedTime === option.value}
                className={`bcfTime${selectedTime === option.value ? " is-on" : ""}`}
                onClick={() => onTimeChange?.(option.value)}
              >
                {toPersianDigits(option.label)}
              </button>
            ))}
          </div>
        ) : (
          <p className="bcfEmptyTimes">برای این روز نوبت آزادی نیست.</p>
        )}
      </section>

      <div className="bcfFoot">
        {hint ? <p className="bcfHint">{hint}</p> : null}
        <button type="submit" className="bcfSubmit" disabled={!canSubmit}>
          <CalendarCheck size={18} aria-hidden="true" />
          {isBusy
            ? "در حال ثبت…"
            : canSubmit
              ? `ثبت رزرو · ${activeDay.label} ${toPersianDigits(selectedTime)}`
              : "ثبت رزرو"}
        </button>
      </div>
    </form>
  );
}
