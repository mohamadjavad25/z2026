"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ExitPlanPanel } from "../exit/ExitPlanPanel";
import { Stepper } from "./Stepper";
import { addLeave, getLeaves, removeLeave } from "../../shared/api/team";
import { dateKeyAfter } from "../../shared/lib/artistPlace";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { clockLabel, leaveText } from "./teamWeek";

const SPANS = [["today", "امروز"], ["tomorrow", "فردا"], ["days", "چند روز"]];

/**
 * «نمی‌تونم بیام» (owner's decision 2026-10-28): an artist's leave for today, tomorrow or some days, the whole day or some
 * hours. It stops new bookings in that time; bookings already inside it must first be handed over or cancelled with notice
 * (the same list as leaving a team), so nobody's booking is broken without a word. The salons they work with are told.
 * Since 2026-10-30 (owner's request: small and clean, like the break) it is a «مرخصی» button beside «تایم استراحت» on the
 * artist's bookings, shown only to an artist on a salon's team, with one slim line per upcoming leave and «برش دار».
 */
export function useArtistLeaves({ onNotice }) {
  const [leaves, setLeaves] = useState([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await getLeaves();
      if (result.ok) setLeaves(result.data?.leaves || []);
    } catch {
      // no lines until it loads
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(leave) {
    setBusy(String(leave.id));
    try {
      const result = await removeLeave(leave.id);
      if (result.ok) { setLeaves(result.data?.leaves || []); onNotice?.("مرخصی برداشته شد؛ دوباره سر کاری."); }
      else onNotice?.(result.payload?.error || "برداشته نشد؛ دوباره بزن.");
    } catch {
      onNotice?.("برداشته نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setBusy("");
    }
  }

  return { leaves, busy, load, remove };
}

/** One slim line per upcoming leave, styled like the daily break's line. */
export function LeaveLines({ leaves, busy, onRemove }) {
  if (!leaves.length) return null;
  return leaves.map((leave) => (
    <div className="artistBreakBanner is-leave" key={leave.id}>
      <CalendarOff size={15} aria-hidden="true" />
      <span>مرخصی: <b>{leaveText(leave)}</b></span>
      <button type="button" disabled={busy === String(leave.id)} onClick={() => onRemove(leave)}>{busy === String(leave.id) ? "…" : "برش دار"}</button>
    </div>
  ));
}

export function LeaveSheet({ open, onClose, onDone }) {
  const [span, setSpan] = useState("tomorrow");
  const [lastDay, setLastDay] = useState(3);
  const [hours, setHours] = useState(false);
  const [start, setStart] = useState(14 * 60);
  const [end, setEnd] = useState(18 * 60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);

  useEffect(() => { if (open) { setError(""); setPlan(null); } }, [open]);

  const from = span === "today" ? dateKeyAfter(0) : dateKeyAfter(1);
  const to = span === "days" ? dateKeyAfter(lastDay) : from;
  const body = { from, to, start: hours ? clockLabel(start) : "", end: hours ? clockLabel(end) : "", note: note.trim() };
  const problem = hours && end <= start ? "ساعت پایان باید بعد از ساعت شروع باشه." : "";

  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await addLeave(body);
      if (result.ok) { onDone(`مرخصی ثبت شد؛ ${leaveText(body)} مشتری تازه نوبت نمی‌گیره.`); return; }
      if (result.status === 409 && result.payload?.plan) { setPlan(result.payload.plan); setError(result.payload.error || ""); return; }
      setError(result.payload?.error || "ثبت نشد؛ دوباره بزن.");
    } catch {
      setError("ثبت نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProfileSheet open={open} kicker="مرخصی" title="کی نمی‌تونی بیای؟" panelClassName="tsSheet" onClose={onClose} hideClose>
      <div className="tsChoices" role="group" aria-label="کی">
        {SPANS.map(([value, label]) => <button type="button" key={value} className={span === value ? "is-on" : ""} aria-pressed={span === value} onClick={() => { setSpan(value); setPlan(null); }}>{label}</button>)}
      </div>
      {span === "days" ? (
        <section className="tsBox" aria-label="تا کی">
          <h4>از فردا تا کی؟</h4>
          <Stepper label="تا چند روز دیگه" value={lastDay} onChange={(value) => { setLastDay(value); setPlan(null); }} min={2} max={30} step={1} format={(value) => `${formatRelativeBookingDayLabel(dateKeyAfter(value))}`} />
        </section>
      ) : null}
      <section className="tsBox" aria-label="همهٔ روز یا چند ساعت">
        <h4>همهٔ روز یا چند ساعت؟</h4>
        <div className="tsChoices" role="group" aria-label="همهٔ روز یا چند ساعت">
          <button type="button" className={!hours ? "is-on" : ""} aria-pressed={!hours} onClick={() => { setHours(false); setPlan(null); }}>همهٔ روز</button>
          <button type="button" className={hours ? "is-on" : ""} aria-pressed={hours} onClick={() => { setHours(true); setPlan(null); }}>از ساعتی تا ساعتی</button>
        </div>
        {hours ? (
          <div className="tsRow">
            <div className="tsPair"><span>از ساعت</span><Stepper label="از ساعت" value={start} onChange={(value) => { setStart(value); setPlan(null); }} min={0} max={23 * 60} step={30} format={clockLabel} /></div>
            <div className="tsPair"><span>تا ساعت</span><Stepper label="تا ساعت" value={end} onChange={(value) => { setEnd(value); setPlan(null); }} min={30} max={24 * 60 - 30} step={30} format={clockLabel} /></div>
          </div>
        ) : null}
      </section>
      <label className="tsBox tsNote">
        <h4>یه خط برای خودت (اگه خواستی)</h4>
        <input type="text" value={note} maxLength={120} placeholder="مثلاً: مسافرت" onChange={(event) => setNote(event.target.value)} />
      </label>

      {plan ? (
        <ExitPlanPanel
          plan={plan}
          scope="leave"
          params={body}
          message={error || "تو این وقت‌ها نوبت داری. هر نوبت رو به یه آرتیست دیگه بده یا با خبر به مشتری لغو کن."}
          onPlan={setPlan}
          onNotice={() => {}}
        />
      ) : error ? <p className="tsError" role="alert">{error}</p> : null}
      {problem ? <p className="tsError" role="alert">{problem}</p> : null}
      <button type="button" className="tsSend" disabled={busy || Boolean(problem) || Boolean(plan?.blocked)} onClick={save}>{busy ? "یه لحظه…" : plan?.blocked ? "اول نوبت‌ها رو جواب بده" : "ثبت مرخصی"}</button>
      <p className="tsHint">مشتری‌های تازه اون وقت نمی‌تونن نوبت بگیرن. سالن‌هایی که توی تیمشونی هم خبردار می‌شن.</p>
    </ProfileSheet>
  );
}
