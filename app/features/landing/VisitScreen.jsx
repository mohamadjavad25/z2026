"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BellRing, CalendarDays, ChevronLeft, Link2, Phone, Smartphone, Store, UserRound } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { useQrCode } from "../../shared/hooks/useQrCode";
import { START_STEPS, VISIT_CATEGORIES, VISIT_PLAIN_SOURCE, VISIT_SIGNUP_URL, VISIT_SOURCE } from "./visitCatalog";
import { VisitMock } from "./visitMocks";

/**
 * frfro.ir/v: the catalog a field visitor shows a salon owner or an artist in person (owner, 2026-11-13). First the
 * two categories, then that category's deck: one idea per slide, swiped sideways (or the arrows on a tablet, or the
 * keyboard). The phone's back key returns to the categories. The last slide's QR opens /s/v on the owner's own phone.
 * `plain` (frfro.ir/v/clean) draws a clean stand-in instead of each screen picture.
 */

function beacon(source, kind) {
  try {
    const body = JSON.stringify({ source, kind });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/landing-visit", new Blob([body], { type: "application/json" }));
  } catch {}
}

const fill = (text, days) => String(text || "").replace(/\{days\}/g, days);

export function VisitScreen({ trialDays, plans, monthly, smsPerMonth, plain = false }) {
  const [categoryId, setCategoryId] = useState(null);
  const category = VISIT_CATEGORIES.find((item) => item.id === categoryId) || null;

  useEffect(() => {
    beacon(plain ? VISIT_PLAIN_SOURCE : VISIT_SOURCE, "open");
    const onPop = () => setCategoryId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [plain]);

  function open(id) {
    window.history.pushState({ visitDeck: id }, "");
    setCategoryId(id);
  }

  function close() {
    if (window.history.state?.visitDeck) window.history.back();
    else setCategoryId(null);
  }

  return (
    <main className={`vcat${plain ? " is-plain" : ""}`} dir="rtl">
      {category ? (
        <Deck key={category.id} category={category} trialDays={trialDays} plans={plans?.[category.id] || []} monthly={monthly?.[category.id]} smsPerMonth={smsPerMonth} plain={plain} onClose={close} />
      ) : (
        <Picker onPick={open} />
      )}
    </main>
  );
}

function Picker({ onPick }) {
  return (
    <section className="vcat__picker">
      <div className="vcat__brand">
        <img src="/icons/icon-192.png" alt="" width="40" height="40" />
        <span>فرفرو</span>
      </div>
      <div className="vcat__pickerHead">
        <h1>نوبت‌دهی آنلاین<br /><em>برای سالن و آرتیست</em></h1>
        <p>با کی صحبت می‌کنی؟</p>
      </div>
      <div className="vcat__cats">
        {VISIT_CATEGORIES.map((item) => (
          <button key={item.id} type="button" className={`vcat__cat is-${item.id}`} onClick={() => onPick(item.id)}>
            <span className="vcat__catText">
              <b>{item.pick}</b>
              <small>{item.hint}</small>
            </span>
            <span className="vcat__catIcons" aria-hidden="true">
              {item.icons.map((icon) => <ServiceIcon key={icon} emoji={icon} size="sm" />)}
            </span>
            <span className="vcat__catGo" aria-hidden="true"><ChevronLeft size={22} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Deck({ category, trialDays, plans, monthly, smsPerMonth, plain, onClose }) {
  const trackRef = useRef(null);
  const slideRefs = useRef([]);
  const [index, setIndex] = useState(0);
  const count = category.slides.length;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return undefined;
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setIndex(Number(entry.target.dataset.index));
      }
    }, { root: track, threshold: 0.6 });
    slideRefs.current.forEach((el) => el && seen.observe(el));
    return () => seen.disconnect();
  }, [category.id]);

  const go = useCallback((to) => {
    const next = Math.max(0, Math.min(count - 1, to));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    slideRefs.current[next]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "start" });
  }, [count]);

  useEffect(() => {
    const onKey = (event) => {
      // Right to left: the next slide is to the left.
      if (event.key === "ArrowLeft") go(index + 1);
      else if (event.key === "ArrowRight") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  return (
    <section className={`vcat__deck is-${category.id}`} aria-label={`فرفرو برای ${category.label}`}>
      <header className="vcat__bar">
        <button type="button" className="vcat__back" onClick={onClose}>
          <ArrowRight size={18} aria-hidden="true" />
          <span>{category.label}</span>
        </button>
        <div className="vcat__progress" aria-hidden="true">
          {category.slides.map((slide, i) => (
            <span key={i} className={i <= index ? "is-on" : ""} />
          ))}
        </div>
      </header>

      <div className="vcat__track" ref={trackRef}>
        {category.slides.map((slide, i) => (
          <article key={i} data-index={i} ref={(el) => { slideRefs.current[i] = el; }} className={`vcat__slide is-${slide.kind}`} aria-roledescription="اسلاید" aria-label={`${i + 1} از ${count}`}>
            <div className="vcat__copy">
              {slide.eyebrow ? <span className={`vcat__eyebrow is-${slide.side || "pro"}`}>{slide.eyebrow}</span> : null}
              <h2>{fill(slide.title, trialDays)}</h2>
              {slide.text ? <p>{fill(slide.text, trialDays)}</p> : null}
            </div>
            <div className="vcat__visual">
              <Visual slide={slide} category={category} trialDays={trialDays} plans={plans} monthly={monthly} smsPerMonth={smsPerMonth} plain={plain} active={i === index} />
            </div>
          </article>
        ))}
      </div>

      <footer className="vcat__nav">
        <button type="button" className="vcat__arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label="قبلی">
          <ArrowRight size={20} />
        </button>
        <span className="vcat__count">{toFa(index + 1)} / {toFa(count)}</span>
        <button type="button" className="vcat__arrow is-next" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="بعدی">
          <ArrowLeft size={20} />
        </button>
      </footer>
    </section>
  );
}

const toFa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

function Visual({ slide, category, trialDays, plans, monthly, smsPerMonth, plain, active }) {
  switch (slide.kind) {
    case "intro":
      return (
        <div className="vcat__orbit" aria-hidden="true">
          {category.icons.map((icon, i) => (
            <span key={icon} className={`vcat__orb is-${i}`}><ServiceIcon emoji={icon} size="xl" /></span>
          ))}
          <span className="vcat__orbCore"><img src="/icons/icon-192.png" alt="" width="72" height="72" /></span>
        </div>
      );
    case "screen":
      if (plain) return <VisitMock name={slide.mock} />;
      return (
        <figure className={`vcat__phone is-${slide.side}`}>
          <img src={`/tutorial/${slide.image}.webp`} alt="" width="585" height="1266" loading="lazy" decoding="async" />
        </figure>
      );
    case "notify":
      return (
        <div className="vcat__notes">
          {slide.notes.map((note, i) => (
            <div key={note.when} className="vcat__note" style={{ "--d": `${i * 0.18}s` }}>
              <span className="vcat__noteIcon" aria-hidden="true"><BellRing size={18} /></span>
              <span className="vcat__noteBody">
                <small>فرفرو · {note.when}</small>
                <b>{note.line}</b>
              </span>
            </div>
          ))}
        </div>
      );
    case "calendar":
      return (
        <div className="vcat__day">
          <div className="vcat__dayHead"><CalendarDays size={18} aria-hidden="true" /><b>امروز</b></div>
          {[
            { time: "۱۰:۰۰", from: "app", icon: "haircut", label: "از فرفرو" },
            { time: "۱۱:۳۰", from: "phone", icon: "manicure", label: "تلفنی" },
            { time: "۱۴:۰۰", from: "app", icon: "highlights", label: "از فرفرو" }
          ].map((row) => (
            <div key={row.time} className={`vcat__slot is-${row.from}`}>
              <span className="vcat__slotTime">{row.time}</span>
              <ServiceIcon emoji={row.icon} size="sm" />
              <span className="vcat__slotFrom">{row.from === "phone" ? <Phone size={14} aria-hidden="true" /> : <Smartphone size={14} aria-hidden="true" />}{row.label}</span>
            </div>
          ))}
        </div>
      );
    case "team":
      return (
        <div className="vcat__team">
          {[["haircut", "highlights"], ["manicure"], ["eyebrow", "lipstick"]].map((icons, col) => (
            <div key={col} className="vcat__lane">
              <span className="vcat__laneHead" aria-hidden="true"><UserRound size={20} /></span>
              {icons.map((icon) => <span key={icon} className="vcat__laneJob"><ServiceIcon emoji={icon} size="sm" /></span>)}
            </div>
          ))}
        </div>
      );
    case "link":
      return (
        <div className="vcat__page">
          <div className="vcat__pageHead">
            <span className="vcat__avatar" aria-hidden="true"><UserRound size={28} /></span>
            <span className="vcat__url"><Link2 size={14} aria-hidden="true" />frfro.ir/…</span>
          </div>
          <div className="vcat__grid" aria-hidden="true">
            {["lipstick", "eyebrow", "bridal", "facial", "manicure", "highlights"].map((icon) => <span key={icon}><ServiceIcon emoji={icon} size="lg" /></span>)}
          </div>
        </div>
      );
    case "collab":
      return (
        <div className="vcat__collab" aria-hidden="true">
          <span className="vcat__node"><UserRound size={30} /><small>تو</small></span>
          <span className="vcat__wire" />
          <span className="vcat__node is-salon"><Store size={30} /><small>سالن</small></span>
        </div>
      );
    case "price":
      return (
        <div className="vcat__price">
          {monthly ? <p className="vcat__monthly"><b>{monthly}</b> هزار تومن در ماه</p> : null}
          <ul>
            {plans.map((plan) => (
              <li key={plan.id}>
                <span>{plan.label}{plan.gift ? <small>{plan.gift}</small> : null}</span>
                <b>{plan.price}</b>
              </li>
            ))}
          </ul>
          <p className="vcat__fine">مشتری‌ها همیشه رایگانن · ماهی {smsPerMonth} پیامک برای مشتری‌هات</p>
        </div>
      );
    case "faq":
      return (
        <dl className="vcat__faq">
          {slide.items.map((item) => (
            <div key={item.q}>
              <dt>{fill(item.q, trialDays)}</dt>
              <dd>{fill(item.a, trialDays)}</dd>
            </div>
          ))}
        </dl>
      );
    case "start":
      return <Start active={active} trialDays={trialDays} />;
    default:
      return null;
  }
}

function Start({ active, trialDays }) {
  const qr = useQrCode(VISIT_SIGNUP_URL, active);
  return (
    <div className="vcat__start">
      <div className="vcat__qr">
        {qr ? <img src={qr} alt="کد QR شروع فرفرو" width="320" height="320" /> : <span className="vcat__qrWait" />}
      </div>
      <p className="vcat__scan">با دوربین گوشیت اسکن کن · {trialDays} روز رایگان</p>
      <ol className="vcat__steps">
        {START_STEPS.map((step, i) => (
          <li key={step}><span>{toFa(i + 1)}</span>{step}</li>
        ))}
      </ol>
    </div>
  );
}
