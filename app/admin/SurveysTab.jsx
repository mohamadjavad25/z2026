"use client";

import { useState } from "react";
import { CircleAlert, Eye, MessageSquareHeart, RefreshCw, Undo2, UserRound } from "lucide-react";
import { Button } from "../components/ui";
import { FEELS, partsOf } from "../shared/lib/welcomeSurvey";
import { api } from "./adminFetch";
import { TYPE_LABEL, ago, num } from "./format";
import { PageHead } from "./PageHead";
import { Card, EmptyState, ErrorNote, Loading, Segmented, toastResult, useAdminData, withQuery } from "./ui";

/** Every part's words, whichever role it belongs to. */
const PART_LABEL = new Map(["artist", "salon", "client"].flatMap((role) => partsOf(role)));
const ROLES = [{ value: "", label: "همه" }, { value: "salon", label: "سالن" }, { value: "artist", label: "آرتیست" }, { value: "client", label: "مشتری" }];
const PERIODS = [{ value: "7", label: "۷ روز اخیر" }, { value: "30", label: "۳۰ روز اخیر" }, { value: "", label: "همهٔ زمان‌ها" }];
const WAITING_LABEL = { pushed: "اعلان گرفت و جواب نداده", put_off: "گفت بعداً" };

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** One labelled bar. The bar is only a picture; the words and numbers beside it carry the same facts. */
function BarRow({ label, count, of }) {
  const share = percent(count, of);
  return (
    <li className="admBarRow">
      <span className="admBarText"><strong>{label}</strong><span className="admMuted">{num(count)} نفر ({num(share)}٪)</span></span>
      <span className="admBar" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
    </li>
  );
}

/** One answer: who, what they said, and the admin's own «seen» mark and note. */
function Answer({ answer, onGo, onSaved }) {
  const [note, setNote] = useState(answer.note || "");
  const [saving, setSaving] = useState(false);
  async function save(seen) {
    if (saving) return;
    setSaving(true);
    const result = await api.post("/api/admin/welcome-survey", { userId: answer.user_id, seen, note });
    setSaving(false);
    if (toastResult(result, seen ? "علامت «دیدم» خورد." : "به حالت دیده‌نشده برگشت.")) onSaved();
  }
  const parts = answer.parts.map((part) => PART_LABEL.get(part) || part).join("، ");
  return (
    <li className={`admSurveyItem${answer.seen_at ? " is-seen" : ""}`}>
      <div className="admSurveyHead">
        <strong>{answer.name || "بی‌نام"}</strong>
        <span className="admMuted">{TYPE_LABEL[answer.type] || answer.type} • شمارهٔ {num(answer.user_id)} • {ago(answer.answered_at)}</span>
        {answer.attention ? <span className="admSurveyBadge is-bad"><CircleAlert size={13} aria-hidden="true" /> نیاز به توجه</span> : null}
        {answer.seen_at ? <span className="admSurveyBadge is-good"><Eye size={13} aria-hidden="true" /> دیده شد</span> : null}
      </div>
      <p>{FEELS[answer.feel] ?? "بدون امتیاز"}{parts ? ` • ${parts}` : ""}</p>
      {answer.idea ? <p className="admSurveyIdea">{answer.idea}</p> : null}
      <label className="admLabel">
        <span>یادداشت تو (فقط مدیرها می‌بینن)</span>
        <textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="admSurveyActions">
        <Button size="sm" variant="secondary" onClick={() => onGo?.("users", { id: answer.user_id })}><UserRound size={15} aria-hidden="true" /> پروندهٔ کاربر</Button>
        {answer.seen_at
          ? <Button size="sm" variant="secondary" disabled={saving} onClick={() => save(false)}><Undo2 size={15} aria-hidden="true" /> برگردون به دیده‌نشده</Button>
          : <Button size="sm" disabled={saving} onClick={() => save(true)}><Eye size={15} aria-hidden="true" /> دیدم</Button>}
        {answer.seen_at && note !== (answer.note || "") ? <Button size="sm" variant="secondary" disabled={saving} onClick={() => save(true)}>ذخیرهٔ یادداشت</Button> : null}
      </div>
    </li>
  );
}

/** What people said in the welcome survey: how far it got, how people felt, who is still waiting, and each answer. */
export function SurveysTab({ onGo }) {
  const [role, setRole] = useState("");
  const [days, setDays] = useState("30");
  const { data, error, loading, reload } = useAdminData(withQuery("/api/admin/welcome-survey", { role, days }), { every: 60 * 1000 });
  const head = (
    <PageHead tab="surveys">
      <Button variant="secondary" size="sm" disabled={loading} onClick={reload}><RefreshCw size={15} aria-hidden="true" /> تازه کن</Button>
    </PageHead>
  );
  const filters = (
    <div className="admSurveyFilters">
      <Segmented label="نقش" options={ROLES} value={role} onChange={setRole} size="sm" />
      <Segmented label="بازهٔ زمانی" options={PERIODS} value={days} onChange={setDays} size="sm" />
    </div>
  );
  if (!data) return <>{head}{filters}{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</>;

  const { totals, average, enough, needed, feels, parts, waiting, answers } = data;
  const feelCount = (index) => feels.find((row) => row.feel === index)?.count || 0;

  return (
    <>
      {head}
      {filters}
      {error ? <ErrorNote error="گزارش نیومد." onRetry={reload} /> : null}
      <div className="admGrid" role="list" aria-label="خلاصهٔ نظرسنجی">
        <div className="admStat" role="listitem"><small>نظرسنجی بهشون رسید</small><b>{num(totals.reached)} نفر</b><em>اعلان گرفتن، بعداً زدن یا جواب دادن</em></div>
        <div className="admStat" role="listitem"><small>جواب دادن</small><b>{num(totals.answered)} نفر</b><em>{totals.unseen ? `${num(totals.unseen)} تا هنوز ندیدی` : "همه‌ش دیده شده"}</em></div>
        <div className="admStat" role="listitem"><small>درصد جواب</small><b>{totals.rate === null ? "—" : `${num(totals.rate)}٪`}</b><em>از کسایی که بهشون رسید</em></div>
        <div className="admStat" role="listitem"><small>میانگین راحتی</small><b>{average === null ? "—" : `${num(average)} از ۵`}</b><em>{enough ? "۱ یعنی خیلی سخت، ۵ یعنی خیلی راحت" : "هنوز جواب کافی نیست"}</em></div>
      </div>

      {totals.reached ? (
        <Card title="نظرسنجی تا کجا رفت؟" icon={MessageSquareHeart}>
          <ul className="admBars">
            <BarRow label="بهشون رسید" count={totals.reached} of={totals.reached} />
            <BarRow label="گفتن بعداً" count={totals.put_off} of={totals.reached} />
            <BarRow label="جواب دادن" count={totals.answered} of={totals.reached} />
          </ul>
        </Card>
      ) : null}

      {waiting.length ? (
        <Card title={`منتظر جواب (${num(waiting.length)} نفر)`}>
          <ul className="admSurveyList">
            {waiting.map((person) => (
              <li key={person.user_id} className="admSurveyItem">
                <div className="admSurveyHead">
                  <strong>{person.name || "بی‌نام"}</strong>
                  <span className="admMuted">{TYPE_LABEL[person.type] || person.type} • {WAITING_LABEL[person.status]} • {ago(person.at)}</span>
                </div>
                <div className="admSurveyActions">
                  <Button size="sm" variant="secondary" onClick={() => onGo?.("users", { id: person.user_id })}><UserRound size={15} aria-hidden="true" /> پروندهٔ کاربر</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {answers.length ? (
        <>
          {enough ? null : <p className="admNote">هنوز جواب کافی نیست. با {num(totals.answered)} جواب، درصدها فقط حدسه. تا ۱۰ جواب {num(needed)} تا مونده.</p>}
          <Card title="کار با فرفرو چطور بود؟">
            <ul className="admBars">{FEELS.map((label, index) => <BarRow key={label} label={label} count={feelCount(index)} of={totals.answered} />)}</ul>
          </Card>
          <Card title="کجاش سخت بود؟">
            <ul className="admBars">{parts.map((row) => <BarRow key={row.part} label={PART_LABEL.get(row.part) || row.part} count={row.count} of={totals.answered} />)}</ul>
          </Card>
          <Card title="جواب‌ها">
            <ul className="admSurveyList">
              {answers.map((answer) => <Answer key={`${answer.user_id}-${answer.seen_at || "new"}`} answer={answer} onGo={onGo} onSaved={reload} />)}
            </ul>
          </Card>
        </>
      ) : (
        <EmptyState icon={MessageSquareHeart} title="هنوز کسی جواب نداده">
          {totals.reached
            ? `${num(totals.reached)} نفر نظرسنجی رو گرفتن${totals.put_off ? ` و ${num(totals.put_off)} نفرشون بعداً زدن` : ""}. جواب‌ها که بیاد اینجا می‌بینی.`
            : "هنوز نظرسنجی به کسی نرسیده. جواب‌ها اینجا میان."}
        </EmptyState>
      )}
    </>
  );
}
