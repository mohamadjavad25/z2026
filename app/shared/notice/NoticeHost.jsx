"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bell, CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { dismissNotice, getNotices, subscribeNotices } from "./noticeStore";

const LEAVE_MS = 240;
const NO_NOTICES = [];
const NOTE_ICON = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleX };
/** Past this many letters a short pill («island», «pill») becomes a full-width card, so the text wraps to lines. */
const LONG_NOTICE_CHARS = 40;

/**
 * Mounts the top-of-screen notices. Put it once per app (the shell and the admin panel).
 * It portals to <body> so no parent stacking context can hide it. The notices come from
 * notify() in noticeStore.js, so callers never render this themselves.
 */
export function NoticeHost() {
  const notices = useSyncExternalStore(subscribeNotices, getNotices, () => NO_NOTICES);
  if (!notices.length || typeof document === "undefined") return null;
  const onTop = notices.filter((notice) => notice.kind !== "steps");
  const sheet = notices.find((notice) => notice.kind === "steps");
  return createPortal(
    <>
      {onTop.length ? (
        <div className="noticeStack" aria-live="polite">
          {onTop.map((notice) => (
            <Notice key={notice.id} notice={notice} />
          ))}
        </div>
      ) : null}
      {sheet ? <StepsSheet key={sheet.id} notice={sheet} /> : null}
    </>,
    document.body
  );
}

/**
 * Instructions in several steps: a small sheet at the bottom with numbered lines. It stays until «باشه», a tap
 * outside it or Escape, so it can be read while the person goes and does the steps.
 */
function StepsSheet({ notice }) {
  const { id, title, items, doneLabel } = notice;
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const doneRef = useRef(null);

  const close = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => dismissNotice(id), LEAVE_MS);
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    doneRef.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`noticeSheetLayer${leaving ? " is-leaving" : ""}`}>
      <div className="noticeSheetScrim" aria-hidden="true" onClick={close} />
      <div className="noticeSheet" role="dialog" aria-modal="true" aria-label={title || "راهنما"}>
        <span className="noticeSheetGrab" aria-hidden="true" />
        {title ? <b className="noticeSheetTitle">{title}</b> : null}
        <ol className="noticeSheetSteps">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
        <button ref={doneRef} type="button" className="noticeAction noticeSheetDone" onClick={close}>
          {doneLabel || "باشه"}
        </button>
      </div>
    </div>
  );
}

/**
 * One notice. It leaves by itself after `timer` ms (0 means it stays until closed). While a finger or the mouse rests
 * on it the countdown waits, so a long message can be read to its end.
 */
function Notice({ notice }) {
  const { id, kind, tone, timer, action, title, text, big, label, avatar, p } = notice;
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);
  const leftRef = useRef(timer);
  const leavingRef = useRef(false);

  const close = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => dismissNotice(id), LEAVE_MS);
  };

  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!timer || held) return undefined;
    const startedAt = Date.now();
    const timeout = window.setTimeout(() => closeRef.current(), leftRef.current);
    return () => {
      window.clearTimeout(timeout);
      leftRef.current = Math.max(800, leftRef.current - (Date.now() - startedAt));
    };
  }, [timer, held]);
  const hold = timer ? () => setHeld(true) : undefined;
  const release = timer ? () => setHeld(false) : undefined;

  const runAction = () => {
    try {
      action?.onClick?.();
    } finally {
      close();
    }
  };

  const short = kind === "island" || kind === "pill";
  const long = short && `${title || ""} ${text || ""}`.trim().length > LONG_NOTICE_CHARS;
  const className = `notice notice-${kind} is-${tone}${long ? " is-long" : ""}${leaving ? " is-leaving" : ""}${held ? " is-held" : ""}`;
  const style = timer ? { "--notice-timer": `${timer}ms` } : undefined;
  const actionButton = action ? (
    <button type="button" className="noticeAction" onClick={runAction}>{action.label}</button>
  ) : null;
  const closeButton = short ? null : (
    <button type="button" className="noticeClose" aria-label="بستن" onClick={close}>
      <X size={16} />
    </button>
  );
  const timerBar = timer && (!short || long) ? <i className="noticeTimer" aria-hidden="true" /> : null;
  const Icon = NOTE_ICON[tone] || Info;

  return (
    <div
      className={className}
      role={tone === "error" ? "alert" : "status"}
      style={style}
      onPointerEnter={hold}
      onPointerDown={hold}
      onPointerLeave={release}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {kind === "island" ? (
        <>
          <span className="noticePulse" aria-hidden="true" />
          <div className="noticeText">
            <b>{title}</b>
            {text ? <span>{text}</span> : null}
          </div>
          {actionButton}
        </>
      ) : null}

      {kind === "pill" ? (
        <>
          <CircleCheck size={16} aria-hidden="true" />
          <b>{title}</b>
        </>
      ) : null}

      {kind === "err" ? (
        <>
          <span className="noticeIcon" aria-hidden="true"><CircleX size={18} /></span>
          <div className="noticeText">
            <b>{title}</b>
            {text ? <span>{text}</span> : null}
          </div>
          {actionButton}
          {closeButton}
        </>
      ) : null}

      {kind === "ticket" ? (
        <>
          <div className="noticeSlip">
            {label ? <span className="noticeLabel">{label}</span> : null}
            {big ? <b className="noticeBig">{big}</b> : null}
            <span className="noticeText">
              {title ? <b>{title}</b> : null}
              {text ? <span>{text}</span> : null}
            </span>
          </div>
          <span className="noticeCut" aria-hidden="true" />
          <div className="noticeSide">
            {actionButton}
            {closeButton}
          </div>
        </>
      ) : null}

      {kind === "glass" ? (
        <>
          <span className="noticeAvatar" aria-hidden="true">
            {avatar ? avatar : <Bell size={16} />}
          </span>
          <div className="noticeText">
            <b>{title}</b>
            {text ? <span className="noticeClamp">{text}</span> : null}
          </div>
          {actionButton}
          {closeButton}
        </>
      ) : null}

      {kind === "ring" ? (
        <>
          <div className="noticeDial" style={{ "--notice-p": p ?? 100 }} aria-hidden="true">
            <span>{big}</span>
          </div>
          <div className="noticeText">
            <b>{title}</b>
            {text ? <span>{text}</span> : null}
          </div>
          {actionButton}
          {closeButton}
        </>
      ) : null}

      {kind === "ban" ? (
        <>
          <b className="noticeBig">{big}</b>
          <div className="noticeText">
            <b>{title}</b>
            {text ? <span>{text}</span> : null}
          </div>
          {actionButton}
          {closeButton}
        </>
      ) : null}

      {kind === "note" ? (
        <>
          <Icon size={18} aria-hidden="true" className="noticeIcon" />
          <div className="noticeText">
            <p>
              {title}
              {notice.link && notice.linkLabel ? (
                <>
                  {" "}
                  <a
                    href={notice.link}
                    target={notice.link.startsWith("https://") ? "_blank" : undefined}
                    rel={notice.link.startsWith("https://") ? "noreferrer" : undefined}
                  >
                    {notice.linkLabel}
                  </a>
                </>
              ) : null}
            </p>
          </div>
          {closeButton}
        </>
      ) : null}

      {timerBar}
    </div>
  );
}

