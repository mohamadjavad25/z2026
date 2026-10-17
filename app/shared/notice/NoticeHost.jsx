"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bell, CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { dismissNotice, getNotices, subscribeNotices } from "./noticeStore";

const LEAVE_MS = 240;
const NO_NOTICES = [];
const NOTE_ICON = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleX };

/**
 * Mounts the top-of-screen notices. Put it once per app (the shell and the admin panel).
 * It portals to <body> so no parent stacking context can hide it. The notices come from
 * notify() in noticeStore.js, so callers never render this themselves.
 */
export function NoticeHost() {
  const notices = useSyncExternalStore(subscribeNotices, getNotices, () => NO_NOTICES);
  if (!notices.length || typeof document === "undefined") return null;
  return createPortal(
    <div className="noticeStack" aria-live="polite">
      {notices.map((notice) => (
        <Notice key={notice.id} notice={notice} />
      ))}
    </div>,
    document.body
  );
}

/** One notice. It leaves by itself after `timer` ms (0 means it stays until closed). */
function Notice({ notice }) {
  const { id, kind, tone, timer, action, title, text, big, label, avatar, p } = notice;
  const [leaving, setLeaving] = useState(false);
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
    if (!timer) return undefined;
    const timeout = window.setTimeout(() => closeRef.current(), timer);
    return () => window.clearTimeout(timeout);
  }, [timer]);

  const runAction = () => {
    try {
      action?.onClick?.();
    } finally {
      close();
    }
  };

  const className = `notice notice-${kind} is-${tone}${leaving ? " is-leaving" : ""}`;
  const style = timer ? { "--notice-timer": `${timer}ms` } : undefined;
  const actionButton = action ? (
    <button type="button" className="noticeAction" onClick={runAction}>{action.label}</button>
  ) : null;
  const closeButton = kind === "island" || kind === "pill" ? null : (
    <button type="button" className="noticeClose" aria-label="بستن" onClick={close}>
      <X size={16} />
    </button>
  );
  const timerBar = timer && kind !== "island" && kind !== "pill" ? <i className="noticeTimer" aria-hidden="true" /> : null;
  const Icon = NOTE_ICON[tone] || Info;

  return (
    <div className={className} role={tone === "error" ? "alert" : "status"} style={style}>
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

