"use client";

import { useEffect, useState } from "react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { Stepper } from "./Stepper";
import { WEEK_DAYS, clockLabel, clockMinutes } from "./teamWeek";
import { toPersianDigits } from "../../shared/lib/digits";
import { dateKeyAfter } from "../../shared/lib/artistPlace";

const START_CHOICES = [[7, "۷ روز دیگه"], [14, "۱۴ روز دیگه"], [30, "یه ماه دیگه"]];

/**
 * «پیشنهاد تغییر شرایط»: days, hours and the artist's share with + and −, an optional line, and from when (at least 7
 * days away, owner's answer 3 of 2026-10-28). Either side opens it; `initial` is the current terms, or the waiting
 * proposal when answering it with a counter-offer. The server judges the hours against the salon's own (the error shows here).
 */
export function TermsProposalSheet({ open, otherName, initial, busy, error, onSend, onClose, mode = "change" }) {
  // "change": a change to a standing team (start day + note). "join": an artist's offer before joining (note, no start day);
  // "counter": the salon's answer to that offer (same form).
  // "salon": the salon writing its own join terms (no note, no start day; adds «آرتیست می‌تونه پیشنهاد خودش رو بده»).
  const isSalon = mode === "salon";
  const withLead = mode === "change";
  const [allow, setAllow] = useState(true);
  const [days, setDays] = useState([]);
  const [from, setFrom] = useState(10 * 60);
  const [to, setTo] = useState(18 * 60);
  const [share, setShare] = useState(60);
  const [separate, setSeparate] = useState(false);
  const [own, setOwn] = useState(70);
  const [note, setNote] = useState("");
  const [lead, setLead] = useState(7);

  useEffect(() => {
    if (!open) return;
    const have = String(initial?.days || "").split(/[،,]/).map((item) => item.replace(/[‌\s]/g, ""));
    setDays(WEEK_DAYS.filter((item) => have.includes(item.day.replace(/[‌\s]/g, ""))).map((item) => item.day));
    setFrom(initial?.from ? clockMinutes(initial.from) : 10 * 60);
    setTo(initial?.to ? clockMinutes(initial.to) : 18 * 60);
    setShare(Number.isInteger(initial?.share) ? initial.share : 60);
    setSeparate(Number.isInteger(initial?.ownShare));
    setOwn(Number.isInteger(initial?.ownShare) ? initial.ownShare : 70);
    setNote("");
    setLead(7);
    setAllow(initial?.allowProposals !== false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the content changes, not on a new object from a list refresh
  }, [open, JSON.stringify(initial)]);

  const toggle = (day) => setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  const problem = !days.length ? "دست‌کم یه روز انتخاب کن." : to <= from ? "ساعت پایان باید بعد از ساعت شروع باشه." : "";
  const send = () => onSend({
    days: WEEK_DAYS.filter((item) => days.includes(item.day)).map((item) => item.day).join("، "),
    from: clockLabel(from),
    to: clockLabel(to),
    share,
    ownShare: separate ? own : null,
    ...(isSalon ? { allowProposals: allow } : { note: note.trim() }),
    ...(withLead ? { effectiveFrom: dateKeyAfter(lead) } : {})
  });

  return (
    <ProfileSheet open={open} kicker={isSalon ? "سالن" : "شرایط کار"} title={isSalon ? "شرایط همکاری" : `پیشنهاد تو به ${otherName}`} panelClassName="tsSheet" onClose={onClose} hideClose>
      {isSalon ? (
        <p className="tsLead">برای آرتیست‌های تازه‌ست؛ کسایی که الان تو تیمن دست نمی‌خورن.</p>
      ) : (
        <p className="tsLead">فقط چیزی رو عوض کن که می‌خوای عوض شه. {mode === "join" ? `تا ${otherName} جواب نده، هنوز تو تیم نیستی.` : mode === "counter" ? `تا ${otherName} جواب نده، هنوز تو تیمت نیست.` : `تا ${otherName} جواب نده، شرایط قبلی می‌مونه.`}</p>
      )}

      <section className="tsBox" aria-label="روزها">
        <h4>روزها</h4>
        <div className="tsDays" role="group" aria-label="روزهای کار">
          {WEEK_DAYS.map((item) => (
            <button type="button" key={item.day} className={days.includes(item.day) ? "is-on" : ""} aria-pressed={days.includes(item.day)} aria-label={item.day} onClick={() => toggle(item.day)}>{item.letter}</button>
          ))}
        </div>
      </section>

      <section className="tsBox" aria-label="ساعت">
        <h4>ساعت</h4>
        <div className="tsRow">
            <div className="tsPair"><span>از ساعت</span><Stepper label="از ساعت" value={from} onChange={setFrom} min={0} max={23 * 60} step={30} format={clockLabel} /></div>
            <div className="tsPair"><span>تا ساعت</span><Stepper label="تا ساعت" value={to} onChange={setTo} min={30} max={24 * 60 - 30} step={30} format={clockLabel} /></div>
          </div>
      </section>

      <section className="tsBox" aria-label="سهم آرتیست">
        <h4>سهم آرتیست</h4>
        <Stepper label="سهم آرتیست" value={share} onChange={setShare} min={0} max={100} step={5} format={(value) => `${toPersianDigits(value)} درصد`} />
        <button type="button" className={`tsOption${separate ? " is-on" : ""}`} aria-pressed={separate} onClick={() => setSeparate((value) => !value)}>
          <span><b>درصد جدا برای مشتری‌های خودِ آرتیست</b><small>مشتری‌هایی که خودش میاره. اگه جدا نذاری، یه درصد برای همه‌ست.</small></span>
          <i aria-hidden="true">{separate ? "روشن" : "خاموش"}</i>
        </button>
        {separate ? <Stepper label="سهم آرتیست از مشتری‌های خودش" value={own} onChange={setOwn} min={0} max={100} step={5} format={(value) => `${toPersianDigits(value)} درصد`} /> : null}
      </section>

      {withLead ? (
        <section className="tsBox" aria-label="از کی">
          <h4>از کی اجرا بشه؟</h4>
          <div className="tsChoices" role="group" aria-label="از کی">
            {START_CHOICES.map(([value, label]) => (
              <button type="button" key={value} className={lead === value ? "is-on" : ""} aria-pressed={lead === value} onClick={() => setLead(value)}>{label}</button>
            ))}
          </div>
          <p className="tsHint">نوبت‌هایی که تا اون روز گرفته شده سر جاشون می‌مونن.</p>
        </section>
      ) : null}

      {isSalon ? (
        <button type="button" className={`tsOption${allow ? " is-on" : ""}`} aria-pressed={allow} onClick={() => setAllow((value) => !value)}>
          <span><b>آرتیست می‌تونه پیشنهاد خودش رو بده</b><small>اگه خاموشش کنی، آرتیست فقط می‌تونه قبول کنه یا نیاد.</small></span>
          <i aria-hidden="true">{allow ? "روشن" : "خاموش"}</i>
        </button>
      ) : (
        <label className="tsBox tsNote">
          <h4>یه خط برای {otherName} (اگه خواستی)</h4>
          <input type="text" value={note} maxLength={120} placeholder="مثلاً: صبح‌ها برام سخته" onChange={(event) => setNote(event.target.value)} />
        </label>
      )}

      {error || problem ? <p className="tsError" role="alert">{error || problem}</p> : null}
      <button type="button" className="tsSend" disabled={busy || Boolean(problem)} onClick={send}>{busy ? "یه لحظه…" : isSalon ? "ذخیره" : `بفرست برای ${otherName}`}</button>
    </ProfileSheet>
  );
}
