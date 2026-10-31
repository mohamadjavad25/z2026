"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, ChevronLeft } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { DUE_CUSTOM_MAX, DUE_GAP_CHOICES, DUE_TEXTS, dueText, gapLabel } from "../../shared/lib/dueReminder";

/**
 * «وقتش شده» on the salon's and the artist's side (owner's decisions of 2026-10-25): a card on the services page that asks
 * once («روشنش کن» / «اول فاصله‌ها رو ببینم») and a section below the services where each service's gap and text can be changed.
 * Nothing goes to the clients until the place has confirmed once.
 */

function useDuePlan(reloadKey) {
  const [plan, setPlan] = useState(null);
  const load = useCallback(async () => {
    const { ok, payload } = await apiFetch("/api/due-reminders").catch(() => ({ ok: false }));
    if (ok) setPlan(payload.data);
  }, []);
  useEffect(() => { void load(); }, [load, reloadKey]);
  const send = useCallback(async (body) => {
    const { ok, payload } = await apiFetch("/api/due-reminders", { method: "POST", body: JSON.stringify(body) })
      .catch(() => ({ ok: false, payload: { error: "اینترنتت وصل نیست؛ دوباره بزن." } }));
    if (ok) setPlan(payload.data);
    return ok ? "" : payload?.error || "ذخیره نشد؛ دوباره بزن.";
  }, []);
  return { plan, send };
}

/**
 * The services page with «وقتش شده» around it. Until the place has confirmed once, a card above the services asks
 * («روشنش کن» / «اول فاصله‌ها رو ببینم»); the full list where each gap and text can be changed sits below them. The question
 * lives here, not as a pop-up on the home page (owner's request 2026-10-26: each start-up question in its own section).
 * `reloadKey` changes when the menu changes.
 */
export function DueRemindersSection({ reloadKey = 0, children = null }) {
  const { plan, send } = useDuePlan(reloadKey);
  const ready = plan && plan.services.length;
  return (
    <>
      {ready && !plan.confirmed ? <DueAskCard plan={plan} send={send} /> : null}
      {children}
      {ready ? <DueRulesSection plan={plan} send={send} /> : null}
    </>
  );
}

function DueAskCard({ plan, send }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = plan.services.filter((service) => service.gapDays > 0);
  return (
    <section className="dueCard" aria-labelledby="due-ask-title">
      <div className="dueCardHead">
        <span className="dueCardIcon" aria-hidden="true"><BellRing size={16} /></span>
        <span>
          <b id="due-ask-title">یادآوری وقتش شده</b>
          <small>هنوز خاموشه</small>
        </span>
      </div>
      <p>وقتی وقت دوبارهٔ هر خدمت برسه، یه یادآوری برای مشتری می‌ره تا دوباره نوبت بگیره.</p>
      {shown.length ? (
        <ul className="dueCardList">
          {shown.slice(0, 4).map((service) => (
            <li key={service.name}><span>{service.name}</span><em>{gapLabel(service.gapDays).replace("هر ", "")}</em></li>
          ))}
          {shown.length > 4 ? <li className="is-more">+{toPersianDigits(shown.length - 4)}</li> : null}
        </ul>
      ) : null}
      <div className="dueCardActions">
        <button type="button" className="dueBtn is-main" disabled={busy} onClick={async () => { setBusy(true); await send({ confirm: true }); setBusy(false); }}>
          <Check size={16} aria-hidden="true" />{busy ? "یه لحظه…" : "روشنش کن"}
        </button>
        <button type="button" className="dueLink" onClick={() => setEditing(true)}>{shown.length ? "اول فاصله‌ها رو ببینم" : "فاصله‌ها رو بذار"}</button>
      </div>
      <ProfileSheet open={editing} kicker="خدمت‌ها" title="یادآوری وقتش شده" onClose={() => setEditing(false)}>
        <DueRuleList plan={plan} send={send} />
      </ProfileSheet>
    </section>
  );
}

function DueRulesSection({ plan, send }) {
  return (
    <section className="dueSection" aria-labelledby="due-section-title">
      <h3 id="due-section-title"><BellRing size={16} aria-hidden="true" />یادآوری وقتش شده</h3>
      <p>{plan.confirmed ? "روشنه. برای عوض کردن فاصله یا متن، روی هر خدمت بزن." : "خاموشه؛ با «روشنش کن» بالای خدمت‌ها روشن می‌شه."}</p>
      <DueRuleList plan={plan} send={send} />
    </section>
  );
}

function DueRuleList({ plan, send }) {
  const [open, setOpen] = useState("");
  const editing = plan.services.find((service) => service.name === open) || null;
  return (
    <>
      <ul className="dueList">
        {plan.services.map((service) => (
          <li key={service.name}>
            <button type="button" onClick={() => setOpen(service.name)}>
              <ServiceIcon name={service.name} size="xs" />
              <span>
                <b>{service.name}</b>
                <small>{service.gapDays ? dueText(service, service.name) : "برای این خدمت یادآوری نمی‌ره"}</small>
              </span>
              <em className={service.gapDays ? "" : "is-off"}>{gapLabel(service.gapDays)}</em>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <ProfileSheet open={Boolean(editing)} kicker="یادآوری وقتش شده" title={editing?.name || ""} onClose={() => setOpen("")}>
        {editing ? <DueRuleEditor key={editing.name} service={editing} send={send} onDone={() => setOpen("")} /> : null}
      </ProfileSheet>
    </>
  );
}

function DueRuleEditor({ service, send, onDone }) {
  const [gapDays, setGapDays] = useState(service.gapDays);
  const [textId, setTextId] = useState(service.textId || "a");
  const [customText, setCustomText] = useState(service.customText || "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const rule = { gapDays, textId, customText };
  return (
    <div className="dueEditor">
      <p className="dueLabel">چند وقت بعد از نوبت؟</p>
      <div className="dueChips" role="radiogroup" aria-label="فاصله">
        {DUE_GAP_CHOICES.map((days) => (
          <button key={days} type="button" role="radio" aria-checked={gapDays === days} className={gapDays === days ? "is-on" : ""} onClick={() => setGapDays(days)}>
            {days ? gapLabel(days).replace("هر ", "") : "خاموش"}
          </button>
        ))}
      </div>
      {service.usualGap ? <small className="dueNote">معمولش {gapLabel(service.usualGap).replace("هر ", "")}ه.</small> : null}
      {gapDays ? (
        <>
          <p className="dueLabel">متن اعلان</p>
          <div className="dueTexts" role="radiogroup" aria-label="متن">
            {DUE_TEXTS.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={textId === item.id} className={textId === item.id ? "is-on" : ""} onClick={() => setTextId(item.id)}>
                {item.text(service.name, gapDays)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={textId === "custom"} className={textId === "custom" ? "is-on" : ""} onClick={() => setTextId("custom")}>
              خودم می‌نویسم
            </button>
          </div>
          {textId === "custom" ? (
            <label className="dueCustom">
              <textarea id={`due-custom-${service.name}`} rows={2} maxLength={DUE_CUSTOM_MAX} value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="مثلاً: سارا جان، وقت ناخنت رسیده" />
              <small>{toPersianDigits(customText.length)} از {toPersianDigits(DUE_CUSTOM_MAX)}</small>
            </label>
          ) : null}
          <div className="duePreview">
            <small>مشتری این رو می‌بینه</small>
            <b>{dueText(rule, service.name)}</b>
            <span>بزن و یه ساعت انتخاب کن.</span>
          </div>
        </>
      ) : null}
      {problem ? <p className="dueProblem" role="alert">{problem}</p> : null}
      <button
        type="button"
        className="dueBtn is-main is-wide"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const error = await send({ service: service.name, gapDays, textId, customText });
          setBusy(false);
          if (error) setProblem(error);
          else onDone();
        }}
      >
        {busy ? "دارم ذخیره می‌کنم…" : "ذخیره کن"}
      </button>
    </div>
  );
}
