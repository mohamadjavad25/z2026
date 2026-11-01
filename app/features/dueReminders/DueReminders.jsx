"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { BellRing, Check, ChevronLeft } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { DUE_CUSTOM_MAX, DUE_GAP_CHOICES, DUE_TEXTS, dueText, gapLabel } from "../../shared/lib/dueReminder";

/**
 * «یادآوری نوبت بعدی» on the salon's and the artist's side (owner's decisions of 2026-10-25; named so and moved into one
 * button beside «خدمت تازه» on 2026-11-01): the button opens a sheet that switches it on once and lists each service's gap
 * and text, and each service card shows its gap. Nothing goes to the clients until the place has confirmed once.
 */
export const DUE_NAME = "یادآوری نوبت بعدی";

const DueContext = createContext(null);

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
 * Wraps a services page: loads the plan once and holds its sheet, so the page's toolbar can show <DueRemindersButton />
 * and each card <DueServiceChip />. The question lives here, not as a pop-up on the home page (owner's request
 * 2026-10-26: each start-up question in its own section). `reloadKey` changes when the menu changes.
 */
export function DueRemindersSection({ reloadKey = 0, children = null }) {
  const { plan, send } = useDuePlan(reloadKey);
  const [open, setOpen] = useState(false);
  const ready = Boolean(plan && plan.services.length);
  return (
    <DueContext.Provider value={ready ? { plan, openSheet: () => setOpen(true) } : null}>
      {children}
      {ready ? (
        <ProfileSheet open={open} kicker="خدمت‌ها" title={DUE_NAME} onClose={() => setOpen(false)}>
          <DuePanel plan={plan} send={send} />
        </ProfileSheet>
      ) : null}
    </DueContext.Provider>
  );
}

function shownServices(plan) {
  return plan.services.filter((service) => service.gapDays > 0);
}

/** Beside «خدمت تازه»: the name, whether it is on, and for how many services. Nothing outside DueRemindersSection. */
export function DueRemindersButton() {
  const due = useContext(DueContext);
  if (!due) return null;
  const { plan, openSheet } = due;
  const count = shownServices(plan).length;
  const state = !plan.confirmed ? "خاموشه · روشنش کن" : count ? `روشنه · برای ${toPersianDigits(count)} خدمت` : "روشنه · هیچ خدمتی فاصله نداره";
  return (
    <button type="button" className={`dueOpenBtn${plan.confirmed ? " is-on" : ""}`} onClick={openSheet}>
      <span className="dueOpenIcon" aria-hidden="true"><BellRing size={18} /></span>
      <span className="dueOpenText">
        <b>{DUE_NAME}</b>
        <small><i aria-hidden="true" />{state}</small>
      </span>
      <ChevronLeft size={16} aria-hidden="true" />
    </button>
  );
}

/** On a service card: «هر ۶ هفته یادآوری» while it is on for that service. */
export function DueServiceChip({ name }) {
  const due = useContext(DueContext);
  const service = due?.plan.confirmed ? due.plan.services.find((item) => item.name === name) : null;
  if (!service?.gapDays) return null;
  return <span className="svcChip is-due"><BellRing size={12} aria-hidden="true" />{gapLabel(service.gapDays)} یادآوری</span>;
}

/** The sheet: what it does, on/off, what the client sees, and each service's gap. */
function DuePanel({ plan, send }) {
  const [busy, setBusy] = useState(false);
  const sample = shownServices(plan)[0] || null;
  return (
    <div className="duePanel">
      <p className="duePanelLead">وقتی وقت دوباره‌ی هر خدمت برسه، به مشتری خبر می‌دیم تا دوباره نوبت بگیره.</p>
      {plan.confirmed ? (
        <p className="dueStatus is-on"><Check size={16} aria-hidden="true" />روشنه. برای عوض کردن فاصله یا متن، روی هر خدمت بزن.</p>
      ) : (
        <div className="dueStatus">
          <span>هنوز خاموشه. اول فاصله‌ها رو ببین، بعد روشنش کن.</span>
          <button type="button" className="dueBtn is-main" disabled={busy} onClick={async () => { setBusy(true); await send({ confirm: true }); setBusy(false); }}>
            <Check size={16} aria-hidden="true" />{busy ? "یه لحظه…" : "روشنش کن"}
          </button>
        </div>
      )}
      {sample ? (
        <div className="duePreview is-sample">
          <small>مشتری این رو می‌بینه</small>
          <b>{dueText(sample, sample.name)}</b>
          <span>بزن و یه ساعت انتخاب کن.</span>
        </div>
      ) : null}
      <p className="dueLabel">برای هر خدمت</p>
      <DueRuleList plan={plan} send={send} />
    </div>
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
      <ProfileSheet open={Boolean(editing)} kicker={DUE_NAME} title={editing?.name || ""} onClose={() => setOpen("")}>
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
