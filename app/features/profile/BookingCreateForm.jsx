"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, ChevronDown, Plus } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceIcon } from "../../components/ServiceIcon";

const SUGGESTED_TIMES = 6;

const normalizeOption = (option) => (
  option && typeof option === "object"
    ? {
      value: String(option.value ?? option.day ?? option.label ?? ""),
      label: String(option.label ?? option.day ?? option.value ?? ""),
      free: typeof option.free === "number" ? option.free : undefined
    }
    : { value: String(option || ""), label: String(option || ""), free: undefined }
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
  staffForTime,
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
  // Only the nearest free times are shown first; the rest open on demand.
  const [allTimes, setAllTimes] = useState(false);
  const [tried, setTried] = useState(false);
  const dayFieldName = role === "salon" ? "booking_date" : "date";
  const isBusy = Boolean(submitting);

  const days = useMemo(() => dayOptions.map(normalizeOption).filter((option) => option.value && option.label), [dayOptions]);
  const activeDay = days.find((option) => option.value === dayValue)
    || days.find((option) => option.label === dayValue)
    || days[0]
    || { value: dayValue, label: dayValue };
  const times = useMemo(() => timeOptions.map(normalizeOption).filter((option) => option.value), [timeOptions]);
  const selectedService = serviceOptions.find((item) => item.value === serviceValue) || serviceOptions[0] || null;
  const soleStaff = staffOptions.length === 1 ? staffOptions[0].value : "";
  const pickedStaff = staffValue || soleStaff;
  const selectedTime = times.find((option) => option.value === timeValue) ? timeValue : "";

  // Collapsed view: the nearest few free times, plus the chosen one if it is further out.
  const shownTimes = allTimes ? times : (() => {
    const near = times.slice(0, SUGGESTED_TIMES);
    const chosen = times.find((option) => option.value === selectedTime);
    return chosen && !near.includes(chosen) ? [...near.slice(0, SUGGESTED_TIMES - 1), chosen] : near;
  })();

  // Today is full or already over: hop to the nearest day that still has a free time.
  const nextOpenDay = days.find((option) => option.free > 0);
  useEffect(() => {
    if (activeDay.free === 0 && nextOpenDay && nextOpenDay.value !== activeDay.value) onDayChange?.(nextOpenDay.value);
  }, [activeDay.free, activeDay.value, nextOpenDay?.value, onDayChange]);
  const autoStaff = showStaff && !pickedStaff && selectedTime
    ? (staffOptions.find((person) => person.value === staffForTime?.(selectedTime))?.label || "")
    : "";
  const firstDay = days[0];
  const skippedDays = firstDay && firstDay.free === 0 && nextOpenDay && activeDay.value === nextOpenDay.value;

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

  const missing = [];
  if (!query) missing.push("نام مشتری");
  if (!selectedService) missing.push("خدمت");
  if (!selectedTime) missing.push(times.length ? "ساعت" : "ساعت آزاد (روز دیگری را بزن)");
  const hint = !isBusy && tried && missing.length ? `برای ثبت لازم است: ${missing.join("، ")}` : "";

  function handleSubmit(event) {
    if (isBusy) {
      event.preventDefault();
      return;
    }
    if (!canSubmit) {
      event.preventDefault();
      setTried(true);
      event.currentTarget.querySelector(!query ? 'input[name="client"]' : ".bcfTime, .bcfDay")?.focus();
      return;
    }
    onSubmit?.(event);
  }

  return (
    <form className="bcf" onSubmit={handleSubmit} noValidate>
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
                  onClick={() => { onServiceChange?.(item.value); }}
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
          <h4 id="bcf-staff">آرتیست</h4>
          <input type="hidden" name="staff" value={pickedStaff || staffForTime?.(selectedTime) || staffOptions[0]?.value || ""} />
          <div className="bcfChips" role="radiogroup" aria-label="انتخاب آرتیست">
            {staffOptions.length > 1 ? (
              <button
                type="button"
                role="radio"
                aria-checked={!pickedStaff}
                className={`bcfChip${!pickedStaff ? " is-on" : ""}`}
                onClick={() => onStaffChange?.("")}
              >
                هر آرتیستِ آزاد
              </button>
            ) : null}
            {staffOptions.map((person) => (
              <button
                type="button"
                key={person.value}
                role="radio"
                aria-checked={pickedStaff === person.value}
                className={`bcfChip${pickedStaff === person.value ? " is-on" : ""}`}
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
              aria-disabled={option.free === 0 || undefined}
              className={`bcfDay${activeDay.value === option.value ? " is-on" : ""}${option.free === 0 ? " is-full" : ""}`}
              onClick={() => { if (option.free !== 0) onDayChange?.(option.value); }}
            >
              {option.label}
              {option.free === 0 ? <small>تکمیل</small> : null}
            </button>
          ))}
        </div>
        {skippedDays ? (
          <p className="bcfNote" role="status">{firstDay.label} ساعت خالی ندارد؛ نزدیک‌ترین روزِ آزاد را برایت باز کردیم.</p>
        ) : null}
        {times.length ? (
          <>
            <div className="bcfTimesHead">
              <span>{allTimes ? "همهٔ ساعت‌های خالی" : "نزدیک‌ترین ساعت‌های خالی"}</span>
              <small>{toPersianDigits(times.length)} ساعت خالی</small>
            </div>
            <div className={`bcfTimes${allTimes ? " is-all" : ""}`} role="radiogroup" aria-label="انتخاب ساعت">
              {shownTimes.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  role="radio"
                  aria-checked={selectedTime === option.value}
                  className={`bcfTime${selectedTime === option.value ? " is-on" : ""}`}
                  onClick={() => onTimeChange?.(option.value)}
                >
                  {selectedTime === option.value ? <Check size={14} aria-hidden="true" /> : null}
                  {toPersianDigits(option.label)}
                </button>
              ))}
            </div>
            {showStaff && !pickedStaff && autoStaff ? (
              <p className="bcfWho">آرتیست این ساعت: <b>{autoStaff}</b></p>
            ) : null}
            {times.length > SUGGESTED_TIMES ? (
              <button type="button" className="bcfMore" aria-expanded={allTimes} onClick={() => setAllTimes((open) => !open)}>
                {allTimes ? "نمایش کمتر" : "ساعت‌های دیگر"}
                <ChevronDown size={16} aria-hidden="true" className={allTimes ? "is-open" : ""} />
              </button>
            ) : null}
          </>
        ) : (
          <p className="bcfEmptyTimes">{nextOpenDay ? "برای این روز نوبت آزادی نیست." : "تا هفتهٔ آینده ساعت خالی نمانده؛ ساعت کاری یا رزروهای قبلی را بررسی کن."}</p>
        )}
      </section>

      <div className="bcfFoot">
        {hint ? <p className="bcfHint" role="alert">{hint}</p> : null}
        <button type="submit" className={`bcfSubmit${canSubmit ? "" : " is-incomplete"}`} disabled={isBusy}>
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
