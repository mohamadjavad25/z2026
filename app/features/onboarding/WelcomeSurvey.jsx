"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, X } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { trackAction } from "../../shared/lib/activity";
import { toPersianDigits } from "../../shared/lib/digits";
import { FEELS, NO_TROUBLE, calledBy, greeting, partsOf, praise } from "../../shared/lib/welcomeSurvey";

const MOUTHS = ["M12 27c3-5 11-5 14 0", "M13 26c3-3 9-3 12 0", "M13 25h12", "M13 24c3 3 9 3 12 0", "M12 23c3 5 11 5 14 0"];
const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function Face({ mouth }) {
  return (
    <svg viewBox="0 0 38 38" fill="none" aria-hidden="true">
      <circle cx="19" cy="19" r="17" />
      <circle className="wsEye" cx="13" cy="15.5" r="2.2" />
      <circle className="wsEye" cx="25" cy="15.5" r="2.2" />
      <path d={mouth} />
    </svg>
  );
}

/** How much of their page is ready, and what is left; a tap on a row leaves the survey for that part of the app. */
function PageProgress({ steps, onGo }) {
  const done = steps.filter((step) => step.done);
  const open = steps.filter((step) => !step.done);
  const percent = Math.round((done.length / steps.length) * 100);
  return (
    <>
      <section className="wsCard">
        <div className="wsRing" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="میزان آماده بودن صفحه">
          <svg viewBox="0 0 72 72" aria-hidden="true">
            <defs>
              <linearGradient id="wsGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brand-violet)" />
                <stop offset="100%" stopColor="var(--brand-pink)" />
              </linearGradient>
            </defs>
            <circle className="wsRingTrack" cx="36" cy="36" r={RING_RADIUS} />
            <circle className="wsRingFill" cx="36" cy="36" r={RING_RADIUS} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - percent / 100)} />
          </svg>
          <b>{toPersianDigits(percent)}٪</b>
        </div>
        <div>
          <h3>{open.length ? "صفحه‌ت داره کامل می‌شه" : "صفحه‌ت کامله!"}</h3>
          <p>{open.length ? "این چند تا که تموم بشه، مشتری با خیال راحت‌تر ازت نوبت می‌گیره." : "هر مشتری‌ای که صفحه‌ت رو باز کنه، همه‌چیز رو می‌بینه."}</p>
        </div>
      </section>
      {open.length ? (
        <div className="wsTodos">
          {open.map((step) => (
            <button type="button" className="wsTodo" key={step.id} onClick={() => onGo(step)}>
              <span className="wsTodoDot" aria-hidden="true" />
              <span className="wsTodoText"><strong>{step.label}</strong><small>{step.hint}</small></span>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
      {done.length ? (
        <ul className="wsDone" aria-label="کارهای انجام‌شده">
          {done.map((step) => <li key={step.id}><Check size={13} aria-hidden="true" /> {step.label}</li>)}
        </ul>
      ) : null}
    </>
  );
}

/**
 * The welcome survey, full screen: a welcome with their own name and numbers, three short questions, a thank-you, and
 * for a salon or artist what is left on their page. `onLater` is any way out before answering; `onAnswered` runs once
 * their answer is saved; `onClose` ends it; `onGo` leaves for one open step.
 */
export function WelcomeSurvey({ survey, onLater, onAnswered, onClose, onGo }) {
  const [step, setStep] = useState(0);
  const [feel, setFeel] = useState(null);
  const [parts, setParts] = useState([]);
  const [idea, setIdea] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const rootRef = useRef(null);
  const answered = step === 4;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  // A new step starts at its top, and a screen reader starts there too.
  useEffect(() => {
    rootRef.current?.scrollTo?.(0, 0);
    // Without preventScroll the browser scrolls the whole screen sideways to the heading, by as much as the soft
    // colour shapes reach past the edge.
    rootRef.current?.querySelector("h1, h2")?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") (answered ? onClose : onLater)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, onClose, onLater]);

  function togglePart(id) {
    setParts((current) => {
      if (id === NO_TROUBLE) return current.includes(id) ? [] : [id];
      const rest = current.filter((part) => part !== NO_TROUBLE);
      return rest.includes(id) ? rest.filter((part) => part !== id) : [...rest, id];
    });
  }

  async function send() {
    if (sending) return;
    setSending(true);
    setFailed(false);
    const result = await apiFetch("/api/welcome-survey", {
      method: "POST",
      body: JSON.stringify({ action: "answer", feel, parts, idea: idea.trim() })
    }).catch(() => null);
    setSending(false);
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    trackAction("survey_done");
    onAnswered();
    setStep(4);
  }

  const hard = feel !== null && feel <= 1;
  const canGo = step === 1 ? feel !== null : step === 2 ? parts.length > 0 : true;

  return createPortal(
    <div className="wsRoot" role="dialog" aria-modal="true" aria-label="نظرسنجی فرفرو">
      <div className="wsPage" ref={rootRef}>
        {answered ? null : (
          <button type="button" className="wsClose" aria-label="بستن؛ بعداً جواب می‌دم" onClick={onLater}><X size={20} aria-hidden="true" /></button>
        )}

        {step === 0 ? (
          <section className="wsStep is-welcome" key="welcome">
            <img className="wsMascot" src="/brand/mascot/done.webp" alt="" width="190" height="190" />
            <h1 tabIndex={-1}>{greeting(survey)}</h1>
            <p>{praise(survey)}</p>
            <p>می‌خوایم بدونیم تا اینجا چطور بوده. یه دقیقه بیشتر طول نمی‌کشه.</p>
            <div className="wsActions">
              <button type="button" className="wsNext" onClick={() => setStep(1)}>بگو چطور بود</button>
              <button type="button" className="wsQuiet" onClick={onLater}>بعداً</button>
            </div>
          </section>
        ) : null}

        {step >= 1 && step <= 3 ? (
          <section className="wsStep" key={`question-${step}`}>
            <div className="wsProgress" aria-hidden="true">{[1, 2, 3].map((item) => <i key={item} className={item <= step ? "is-on" : ""} />)}</div>
            <p className="wsCount">سؤال {toPersianDigits(step)} از ۳</p>

            {step === 1 ? (
              <>
                <h2 tabIndex={-1}>کار با فرفرو تا اینجا چطور بود؟</h2>
                <div className="wsFeels">
                  {FEELS.map((label, index) => (
                    <button type="button" key={label} className={`wsFeel${feel === index ? " is-on" : ""}`} aria-pressed={feel === index} onClick={() => setFeel(index)}>
                      <Face mouth={MOUTHS[index]} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h2 tabIndex={-1}>{hard ? "کجاش اذیتت کرد؟" : "کجاش وقتت رو گرفت یا گیجت کرد؟"}</h2>
                <p className="wsHint">هر چندتا که بود رو بزن.</p>
                <div className="wsChips">
                  {partsOf(survey.role).map(([id, label]) => (
                    <button type="button" key={id} className={`wsChip${parts.includes(id) ? " is-on" : ""}`} aria-pressed={parts.includes(id)} onClick={() => togglePart(id)}>{label}</button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2 tabIndex={-1}>{hard ? "بگو چی رو درست کنیم؟" : "چی بود که اگه داشتیم، کارت راحت‌تر می‌شد؟"}</h2>
                <p className="wsHint">اختیاریه. هر چی به ذهنت میاد بنویس.</p>
                <label className="wsLabel" htmlFor="wsIdea">حرفت</label>
                <textarea id="wsIdea" rows={5} maxLength={1000} value={idea} onChange={(event) => setIdea(event.target.value)} />
                {failed ? <p className="wsError" role="alert">جوابت نرسید؛ دوباره بزن.</p> : null}
              </>
            ) : null}

            <div className="wsActions">
              <button type="button" className="wsNext" disabled={!canGo || sending} onClick={step === 3 ? send : () => setStep(step + 1)}>
                {step === 3 ? (sending ? "داره می‌ره…" : "بفرست") : "بعدی"}
              </button>
              <button type="button" className="wsQuiet" onClick={() => setStep(step - 1)}>برگرد</button>
            </div>
          </section>
        ) : null}

        {answered ? (
          <section className="wsStep is-thanks" key="thanks">
            <header>
              <img className="wsMascot is-small" src="/brand/mascot/done.webp" alt="" width="76" height="76" />
              <div>
                <h2 tabIndex={-1}>{calledBy(survey) ? `مرسی ${calledBy(survey)}!` : "مرسی!"}</h2>
                <p>{hard ? "حرفت مستقیم به خودمون رسید. می‌خونیمش و روش کار می‌کنیم." : "حرفت مستقیم به خودمون رسید."}</p>
              </div>
            </header>
            {survey.steps.length ? <PageProgress steps={survey.steps} onGo={onGo} /> : null}
            <div className="wsActions">
              <button type="button" className={survey.steps.some((item) => !item.done) ? "wsQuiet" : "wsNext"} onClick={onClose}>
                {survey.steps.some((item) => !item.done) ? "بعداً تمومش می‌کنم" : "تموم"}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
