"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Clock3, Download, Link2, RotateCcw, Sticker, Type, UserRound, X } from "lucide-react";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { Spinner } from "../../components/Spinner";
import { SheetBackHandler } from "../../components/SheetClose";
import { toPersianDigits } from "../../shared/lib/digits";
import { hasNativeStoryShare, saveStoryNative, shareStoryNative } from "../../shared/lib/storyShare";
import { appTooOldFor, askForAppUpdate } from "../../shared/lib/appUpdate";
import { guideOff, guideShown, guideWanted, markPosted } from "./storyMemory";
import { STORY_MAX_DAYS, STORY_TIMES_PER_DAY, spreadTimes, suggestTimes, toggleDay, toggleTime, usableTimes } from "./storySuggestion";
import { nowDate } from "../../shared/lib/clock.js";
import { LOOKS, TEXTS, WORKS_NEEDED, dayLine, drawStory, headlineLines } from "./storyDrawing";
import { loadFreeSlots, loadWorks } from "./storyData";

// The names other files already import from here keep working.
export { loadFreeSlots, loadWorks } from "./storyData";
export { WORKS_NEEDED, dayLine } from "./storyDrawing";

// What the person hears after each button (one line each).
const SHARED_COPIED = "لینک صفحه‌ت کپی شد؛ توی استوری برچسب لینک رو بزن و بچسبون.";
const SHARED_NOT_COPIED = "توی استوری برچسب لینک رو بزن و لینک صفحه‌ت رو بذار.";
const SAVED_COPIED = "عکس ذخیره شد و لینکت کپی شد. بذارش تو استوری و برچسب لینک رو بچسبون.";
const SAVED_NOT_COPIED = "عکس ذخیره شد. بذارش تو استوری.";
const SAVE_DENIED = "برای ذخیرهٔ عکس، به فرفرو اجازهٔ دسترسی به عکس‌ها رو بده.";
const SAVE_FAILED = "عکس ذخیره نشد؛ یه بار دیگه بزن.";
const NEEDS_UPDATE = "ذخیرهٔ استوری و فرستادنش به اینستاگرام توی نسخهٔ تازه‌ست. به‌روزش کن؛ یه دقیقه طول می‌کشه.";

// The name row is optional (owner's decision 2026-10-30): Instagram already shows the page's own name and picture.
const WHO_KEY = "frfro-story-who";
const OPTS_KEY = "frfro-story-opts";
const MAX_TYPED = 28;

const TOOLS = [
  { id: "times", label: "ساعت‌ها", Icon: Clock3 },
  { id: "text", label: "متن", Icon: Type },
  { id: "look", label: "ظاهر", Icon: UserRound }
];

/**
 * «استوری آماده», full screen (owner's redesign 2026-11-01): one big picture, swiped between looks; three tools under
 * it (times, words, look) that open one small panel at a time; one main button. frfro only suggests (owner's rule
 * 2026-11-01): the first two days that still have a time, up to four times each spread over the day, all of which the
 * person changes freely. Where the phone can share a file (the app, Chrome on Android, Safari on iPhone) the main
 * button sends it to Instagram and the side button saves it; elsewhere saving is the main button. Either way the page
 * link is copied for Instagram's link sticker, and the first three times a short guide shows how to put it on.
 */
export function InstagramStorySheet({ open, name, url, avatar = "", profileType = "", profileId = null, onClose, onNotify }) {
  const [index, setIndex] = useState(0);
  const [works, setWorks] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  // Drawn pictures by look id: { blob, dataUrl } or { failed: true }.
  const [made, setMade] = useState({});
  const [showWho, setShowWho] = useState(false);
  const [tool, setTool] = useState("");
  const [textIdx, setTextIdx] = useState(0);
  const [typed, setTyped] = useState("");
  // The days on the story (day keys, at most two) and the times on each.
  const [onDays, setOnDays] = useState([]);
  const [on, setOn] = useState({});
  const [suggested, setSuggested] = useState({});
  // The link guide: null, or the action to run from its button ("share" | "save" | "done").
  const [guide, setGuide] = useState(null);
  const [copied, setCopied] = useState(false);
  const railRef = useRef(null);
  // While a dot's smooth scroll runs, the rail passes the looks in between; they must not become the look.
  const goingTo = useRef(null);
  const closeRef = useRef(null);
  // The parent passes a new onClose on every render; read through a ref so the app's regular refresh (every few
  // seconds) does not re-run the load below and throw the drawn pictures away (owner's report 2026-10-30).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const looks = LOOKS.filter((l) => !l.needsWork || (works || []).length > 0);
  const look = looks[Math.min(index, looks.length - 1)] || LOOKS[0];

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setMade({});
    setWorks(null);
    setSlots(null);
    setSlotsFailed(false);
    setTool("");
    setGuide(null);
    let savedLook = "night";
    try {
      setShowWho(window.localStorage.getItem(WHO_KEY) === "1");
      const saved = JSON.parse(window.localStorage.getItem(OPTS_KEY) || "{}");
      setTextIdx(Number.isInteger(saved.textIdx) && saved.textIdx >= 0 && saved.textIdx < TEXTS.length ? saved.textIdx : 0);
      setTyped(typeof saved.typed === "string" ? saved.typed.slice(0, MAX_TYPED) : "");
      if (LOOKS.some((l) => l.id === saved.look)) savedLook = saved.look;
    } catch {
      // Nothing remembered: the ready-made choices.
    }
    setOnDays([]);
    setOn({});
    setSuggested({});
    let haveWorks = false;
    const startOn = (freeAny) => {
      // A page with no free time opens on the works; otherwise on the look used last time.
      const pool = LOOKS.filter((l) => !l.needsWork || haveWorks);
      const want = freeAny ? savedLook : "works";
      setIndex(Math.max(0, pool.findIndex((l) => l.id === want)));
    };
    const worksLoad = loadWorks().catch(() => []).then((list) => { haveWorks = list.length > 0; if (!cancelled) setWorks(list); });
    const slotsLoad = profileId && (profileType === "salon" || profileType === "artist")
      ? loadFreeSlots(profileType, profileId).catch(() => { if (!cancelled) setSlotsFailed(true); return []; })
      : Promise.resolve([]);
    Promise.all([worksLoad, slotsLoad]).then(([, days]) => {
      if (cancelled) return;
      const now = nowDate();
      const usable = days.map((day) => ({ ...day, times: usableTimes(day, now) }));
      const picks = suggestTimes(usable, now);
      setSlots(usable);
      setSuggested(picks);
      setOn(picks);
      setOnDays(Object.keys(picks));
      startOn(usable.some((day) => day.times.length));
    });
    const raf = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKey = (event) => { if (event.key === "Escape") onCloseRef.current?.(); };
    document.addEventListener("keydown", onKey);
    return () => { cancelled = true; cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); };
  }, [open, profileType, profileId]);

  // Put the rail on the chosen look once the slides exist.
  useEffect(() => {
    if (!open || works === null || slots === null) return;
    const slide = railRef.current?.children[index];
    slide?.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
    // Only when the data first arrives; swiping moves the rail itself.
  }, [open, works === null, slots === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownDays = (slots || [])
    .filter((day) => onDays.includes(day.key))
    .map((day) => ({ ...day, times: [...(on[day.key] || [])].sort() }))
    .filter((day) => day.times.length);
  const hasFree = (slots || []).some((day) => day.times.length);
  const headline = typed.trim() ? headlineLines(typed) : TEXTS[textIdx];
  const worksReady = works !== null && works.length >= WORKS_NEEDED;
  const dataReady = works !== null && slots !== null;

  function problemFor(l) {
    if (!dataReady) return "";
    if (l.kind === "works") return worksReady ? "" : `برای این استوری دست‌کم ${toPersianDigits(WORKS_NEEDED)} تا نمونه‌کار بذار.`;
    if (slotsFailed) return "وقت‌های خالیت رو نتونستیم بخونیم؛ یه بار دیگه باز کن.";
    if (!hasFree) return "این سه روز وقت خالی نداری. نمونه‌کارهات رو استوری کن.";
    if (!shownDays.length) return "یه روز و یه ساعت رو روشن کن.";
    return "";
  }

  const problem = problemFor(look);
  useEffect(() => {
    if (!open || !dataReady || problem || made[look.id]) return undefined;
    let cancelled = false;
    drawStory(look.id, { name: name || "فرفرو", avatar, works: works || [], days: shownDays, profileType, showWho, headline })
      .then((picture) => { if (!cancelled) setMade((all) => ({ ...all, [look.id]: picture.blob ? picture : { failed: true } })); })
      .catch(() => { if (!cancelled) setMade((all) => ({ ...all, [look.id]: { failed: true } })); });
    return () => { cancelled = true; };
    // shownDays, headline: derived from on, onDays, typed and textIdx, which are listed.
  }, [open, look.id, dataReady, problem, made, name, avatar, works, slots, profileType, showWho, on, onDays, typed, textIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  function remember(next) {
    try {
      window.localStorage.setItem(OPTS_KEY, JSON.stringify({ textIdx, typed, look: look.id, ...next }));
    } catch {
      // Private mode: the choice just lasts while the sheet is open.
    }
  }

  function redraw() {
    setMade({});
  }

  function setWho(next) {
    setShowWho(next);
    redraw();
    try {
      window.localStorage.setItem(WHO_KEY, next ? "1" : "0");
    } catch {
      // Private mode: the choice just lasts while the sheet is open.
    }
  }

  function flipDay(key) {
    const order = (slots || []).map((day) => day.key);
    const next = toggleDay(onDays, key, order);
    setOnDays(next);
    // A day turned on for the first time starts with frfro's spread of its times.
    if (next.includes(key) && !(on[key] || []).length) {
      const day = (slots || []).find((d) => d.key === key);
      setOn((all) => ({ ...all, [key]: spreadTimes(day?.times || []) }));
    }
    redraw();
  }

  function flipTime(dayKey, time) {
    setOn((all) => ({ ...all, [dayKey]: toggleTime(all[dayKey], time) }));
    redraw();
  }

  function resetSuggestion() {
    setOn(suggested);
    setOnDays(Object.keys(suggested));
    redraw();
  }

  if (!open || typeof document === "undefined") return null;

  const picture = made[look.id];
  const preview = picture?.dataUrl || "";
  const file = picture?.blob ? new File([picture.blob], "frfro-story.png", { type: "image/png" }) : null;
  // Inside the Android app the app itself shares and saves (storyShare.js); the WebView can do neither.
  const native = hasNativeStoryShare();
  // An app from before StorySharePlugin can do neither; it would only pretend to save (2026-10-30), so it asks for the update.
  const oldApp = !native && appTooOldFor("StoryShare");
  // Asked of a stand-in file, so the buttons keep their places while a picture is still being drawn.
  const canShareFile = native || oldApp || (typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files: [file || new File([""], "frfro-story.png", { type: "image/png" })] })));

  function onRailScroll() {
    const rail = railRef.current;
    const first = rail?.children[0];
    if (!first) return;
    // RTL rails scroll to negative values in Chrome and Safari; the distance is what counts.
    const next = Math.max(0, Math.min(looks.length - 1, Math.round(Math.abs(rail.scrollLeft) / first.offsetWidth)));
    if (goingTo.current) {
      if (next === goingTo.current.i || Date.now() > goingTo.current.until) goingTo.current = null;
      return;
    }
    if (next !== index) {
      setIndex(next);
      remember({ look: looks[next].id });
      if (looks[next].kind === "works" && tool !== "look") setTool("");
    }
  }

  function goTo(i) {
    goingTo.current = { i, until: Date.now() + 1500 };
    if (looks[i].kind === "works" && tool !== "look") setTool("");
    railRef.current?.children[i]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setIndex(i);
    remember({ look: looks[i].id });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  const postedNow = () => markPosted();
  const sharedNote = (ok) => (ok ? SHARED_COPIED : SHARED_NOT_COPIED);
  const savedNote = (ok) => (ok ? SAVED_COPIED : SAVED_NOT_COPIED);

  // Copies the link and opens the phone's share list; Instagram's «استوری» there opens the story editor with the picture.
  async function share() {
    if (oldApp) {
      askForAppUpdate(NEEDS_UPDATE);
      return;
    }
    if (native) {
      try {
        const result = await shareStoryNative(preview, url);
        postedNow();
        onNotify?.(sharedNote(result.copied));
      } catch {
        save();
      }
      return;
    }
    const ok = await copyLink();
    try {
      await navigator.share({ files: [file] });
      postedNow();
      onNotify?.(sharedNote(ok));
    } catch (error) {
      if (error?.name !== "AbortError") save();
    }
  }

  // Saves the picture (to the gallery in the app) and copies the link.
  async function save() {
    if (!preview) return;
    if (oldApp) {
      askForAppUpdate(NEEDS_UPDATE);
      return;
    }
    if (native) {
      try {
        const result = await saveStoryNative(preview, url);
        postedNow();
        onNotify?.(savedNote(result.copied));
      } catch (error) {
        onNotify?.(error?.code === "DENIED" ? SAVE_DENIED : SAVE_FAILED);
      }
      return;
    }
    const a = document.createElement("a");
    a.href = preview;
    a.download = "frfro-story.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    postedNow();
    onNotify?.(savedNote(await copyLink()));
  }

  // The first few times, the guide comes first; its own button then shares or saves (a tap, so the phone allows it).
  async function start(action) {
    if (!preview) return;
    if (oldApp) {
      askForAppUpdate(NEEDS_UPDATE);
      return;
    }
    if (guideWanted()) {
      setCopied(await copyLink());
      guideShown();
      setGuide(action);
      return;
    }
    if (action === "share") share();
    else save();
  }

  function fromGuide() {
    const action = guide;
    setGuide(null);
    if (action === "share") share();
    else save();
  }

  function slideBody(slide) {
    const own = made[slide.id];
    const why = problemFor(slide);
    if (own?.dataUrl) return <img src={own.dataUrl} alt={`استوری ${slide.label} ${name}`} />;
    if (own?.failed) return <p className="igStudioNote">عکس ساخته نشد؛ یه بار دیگه باز کن.</p>;
    if (why) {
      const toWorks = slide.kind === "free" && !hasFree && !slotsFailed && worksReady;
      return (
        <div className="igStudioEmpty">
          <p className="igStudioNote">{why}</p>
          {toWorks ? <button type="button" onClick={() => goTo(looks.findIndex((l) => l.id === "works"))}>برو به نمونه‌کارها</button> : null}
        </div>
      );
    }
    return <Spinner size={40} />;
  }

  const freeLook = look.kind === "free";
  const tools = TOOLS.filter((t) => freeLook || t.id === "look");
  const activeTool = tools.some((t) => t.id === tool) ? tool : "";

  return createPortal((
    <div className="igStudio" role="dialog" aria-modal="true" aria-label="استوری آماده">
      <div className="igStudioTop">
        <button type="button" ref={closeRef} className="igStudioClose" onClick={onClose} aria-label="بستن استوری آماده">
          <X size={20} aria-hidden="true" />
        </button>
        <b className="igStudioTitle">استوری</b>
        {/* No «·» beside a number here: it reads as the Persian zero («۱۰ از ۵»). */}
        <span className="igStudioCount" aria-live="polite"><b>{look.label}</b><small>{toPersianDigits(index + 1)} از {toPersianDigits(looks.length)}</small></span>
      </div>

      <div className="igStudioRail" ref={railRef} onScroll={onRailScroll}>
        {looks.map((slide, i) => (
          <div key={slide.id} className="igStudioSlide" aria-hidden={i !== index}>
            <div className="igStudioPicture">{works === null || slots === null ? <Spinner size={40} /> : slideBody(slide)}</div>
          </div>
        ))}
      </div>

      <div className="igStudioLooks" role="tablist" aria-label="ظاهر استوری">
        {looks.map((slide, i) => (
          <button key={slide.id} type="button" role="tab" aria-selected={i === index} aria-label={slide.label} className={`igLookDot is-${slide.id}${i === index ? " is-on" : ""}`} onClick={() => goTo(i)} />
        ))}
      </div>

      {activeTool ? (
        <div className="igStudioPanel" role="group" aria-label={TOOLS.find((t) => t.id === activeTool)?.label}>
          {activeTool === "times" ? (
            hasFree ? (
              <div className="igEditBlock">
                <div className="igDays" role="group" aria-label="روزها">
                  {(slots || []).map((day) => {
                    const isOn = onDays.includes(day.key);
                    const none = !day.times.length;
                    return (
                      <button key={day.key} type="button" className={isOn ? "is-on" : ""} aria-pressed={isOn} disabled={none} onClick={() => flipDay(day.key)}>
                        <b>{day.label}</b>
                        <small>{none ? "وقت خالی نداره" : `${toPersianDigits(day.times.length)} وقت`}</small>
                      </button>
                    );
                  })}
                </div>
                <small className="igEditHint"><CalendarDays size={13} aria-hidden="true" /> تا {toPersianDigits(STORY_MAX_DAYS)} روز، هر روز تا {toPersianDigits(STORY_TIMES_PER_DAY)} ساعت. نقطهٔ بنفش یعنی پیشنهاد ما.</small>
                {(slots || []).filter((day) => onDays.includes(day.key) && day.times.length).map((day) => (
                  <div className="igEditDay" key={day.key}>
                    <div className="igEditDayHead">
                      <span>{dayLine(day)}</span>
                      <small>{toPersianDigits((on[day.key] || []).length)} از {toPersianDigits(STORY_TIMES_PER_DAY)}</small>
                    </div>
                    <div className="igEditChips">
                      {day.times.map((time) => {
                        const isOn = (on[day.key] || []).includes(time);
                        const full = !isOn && (on[day.key] || []).length >= STORY_TIMES_PER_DAY;
                        return (
                          <button key={time} type="button" className={`${isOn ? "is-on" : ""}${(suggested[day.key] || []).includes(time) ? " is-suggested" : ""}`} aria-pressed={isOn} disabled={full} onClick={() => flipTime(day.key, time)}>
                            {toPersianDigits(time)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button type="button" className="igEditReset" onClick={resetSuggestion}><RotateCcw size={14} aria-hidden="true" /> برگرد به پیشنهاد ما</button>
              </div>
            ) : <p className="igEditHint">این سه روز وقت خالی نداری.</p>
          ) : null}
          {activeTool === "text" ? (
            <div className="igEditBlock">
              <div className="igEditList">
                {TEXTS.map((lines, i) => (
                  <button key={lines.join(" ")} type="button" className={!typed.trim() && i === textIdx ? "is-on" : ""} onClick={() => { setTextIdx(i); setTyped(""); redraw(); remember({ textIdx: i, typed: "" }); }}>
                    {lines.join(" ")}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="igEditInput"
                value={typed}
                maxLength={MAX_TYPED}
                placeholder="یا خودت بنویس…"
                aria-label="متن دلخواه"
                onChange={(event) => { const value = event.target.value.slice(0, MAX_TYPED); setTyped(value); redraw(); remember({ typed: value }); }}
              />
              <small className="igEditHint">تا {toPersianDigits(MAX_TYPED)} حرف؛ خودش دو خط می‌شه.</small>
            </div>
          ) : null}
          {activeTool === "look" ? (
            <div className="igEditBlock">
              <button type="button" className="igSwitchRow" role="switch" aria-checked={showWho} onClick={() => setWho(!showWho)}>
                <span>اسم و عکس پروفایل</span>
                <i className={showWho ? "is-on" : ""} aria-hidden="true" />
              </button>
              <small className="igEditHint">رنگ رو با کشیدن عکس به چپ و راست عوض کن.</small>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="igStudioTools" role="toolbar" aria-label="ابزارها">
        {tools.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={activeTool === id ? "is-on" : ""} aria-pressed={activeTool === id} onClick={() => setTool(activeTool === id ? "" : id)}>
            <span aria-hidden="true"><Icon size={18} /></span>
            {label}
          </button>
        ))}
      </div>

      <div className="igStudioBar">
        <button type="button" className="igStudioMain" disabled={!preview} onClick={() => start(canShareFile ? "share" : "save")}>
          {canShareFile ? <InstagramGlyph size={19} /> : <Download size={19} aria-hidden="true" />}
          {canShareFile ? "بفرست به اینستاگرام" : "ذخیره عکس"}
        </button>
        {canShareFile ? (
          <button type="button" className="igStudioSave" disabled={!preview} onClick={() => start("save")} aria-label="ذخیره عکس">
            <Download size={20} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {guide ? (
        <div className="igGuideBack" onClick={() => setGuide(null)}>
          <div className="igGuide" role="dialog" aria-modal="true" aria-labelledby="igGuideTitle" onClick={(event) => event.stopPropagation()}>
            <p className={`igGuideCopied${copied ? "" : " is-not"}`}><Link2 size={16} aria-hidden="true" /> {copied ? "لینک صفحه‌ت کپی شد" : "لینک کپی نشد؛ از دکمهٔ «کپی لینک» توی تنظیمات اینستاگرام بردار"}</p>
            <h3 id="igGuideTitle">توی اینستاگرام این سه کار رو بکن</h3>
            <ol className="igGuideSteps">
              <li><b>۱</b><span><Sticker size={18} aria-hidden="true" /></span>برچسب‌ها رو باز کن</li>
              <li><b>۲</b><span className="igGuideLink">LINK</span>«لینک» رو بزن</li>
              <li><b>۳</b><span className="igGuideSlot" aria-hidden="true" />بچسبون و بذارش روی کادر</li>
            </ol>
            <button type="button" className="igStudioMain" onClick={fromGuide}>
              {guide === "share" ? <InstagramGlyph size={19} /> : <Download size={19} aria-hidden="true" />}
              {guide === "share" ? "برو به اینستاگرام" : "ذخیرهٔ عکس"}
            </button>
            <button type="button" className="igGuideOff" onClick={() => { guideOff(); fromGuide(); }}>دیگه نشونم نده</button>
          </div>
        </div>
      ) : null}
      <SheetBackHandler onClose={guide ? () => setGuide(null) : onClose} />
    </div>
  ), document.body);
}
