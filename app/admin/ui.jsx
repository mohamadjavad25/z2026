"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Info, TriangleAlert, X } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { notify } from "../shared/notice/noticeStore";
import { num } from "./format";
import { ClaudeMark, askClaude } from "./ClaudeConnect";

/* ───────────── toasts: short feedback, shown by the shared top-of-screen stack (app/shared/notice) ───────────── */

/** toast("ذخیره شد") or toast("انجام نشد", "error"). Tones: success | error | info. */
export function toast(text, tone = "success") {
  notify({ title: text, tone });
}
/** Shows a result's message: the success text when it worked, the server's error otherwise. Returns ok. */
export function toastResult(result, success) {
  if (result.ok) toast(success, "success");
  else toast(result.payload?.error || "انجام نشد.", "error");
  return result.ok;
}

/** Mounted once in AdminClient. Renders the shared notice stack. */
export { NoticeHost as Toaster } from "../shared/notice/NoticeHost";

/* ───────────── confirm: one dialog for every "are you sure", with an optional reason or typed check ───────────── */

let openConfirm = null;
/**
 * await confirmAction({ title, body, confirmLabel, danger, reason: { label, required, placeholder }, typeToConfirm })
 * resolves to { ok: false } or { ok: true, reason }.
 */
export function confirmAction(options) {
  if (!openConfirm) return Promise.resolve({ ok: window.confirm(options.title) });
  return new Promise((resolve) => openConfirm({ ...options, resolve }));
}

export function ConfirmHost() {
  const [request, setRequest] = useState(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  useEffect(() => {
    openConfirm = (next) => {
      setReason("");
      setTyped("");
      setRequest(next);
    };
    return () => {
      openConfirm = null;
    };
  }, []);
  useEffect(() => {
    if (!request) return undefined;
    const onKey = (event) => event.key === "Escape" && finish(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  if (!request) return null;
  function finish(ok) {
    request.resolve(ok ? { ok: true, reason: reason.trim() } : { ok: false });
    setRequest(null);
  }
  const needsReason = request.reason?.required && reason.trim().length < (request.reason.min || 3);
  const needsTyping = request.typeToConfirm && typed.trim() !== request.typeToConfirm;
  return (
    <div className="admModal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && finish(false)}>
      <form className="admCard admForm admDialog" role="alertdialog" aria-modal="true" aria-labelledby="admConfirmTitle" onSubmit={(event) => { event.preventDefault(); if (!needsReason && !needsTyping) finish(true); }}>
        <div className={`admDialogIcon${request.danger ? " is-danger" : ""}`}>{request.danger ? <TriangleAlert size={22} aria-hidden="true" /> : <Info size={22} aria-hidden="true" />}</div>
        <h2 id="admConfirmTitle">{request.title}</h2>
        {request.body ? <p className="admMuted">{request.body}</p> : null}
        {request.reason ? (
          <label className="admLabel">
            <span>{request.reason.label || "دلیل"}{request.reason.required ? "" : " (اختیاری)"}</span>
            <textarea rows={3} maxLength={request.reason.max || 300} value={reason} placeholder={request.reason.placeholder || ""} autoFocus onChange={(event) => setReason(event.target.value)} />
          </label>
        ) : null}
        {request.typeToConfirm ? (
          <label className="admLabel">
            <span>برای تأیید، <b dir="ltr">{request.typeToConfirm}</b> را تایپ کن</span>
            <input dir="ltr" autoFocus={!request.reason} value={typed} onChange={(event) => setTyped(event.target.value)} />
          </label>
        ) : null}
        <div className="admDialogActions">
          <Button type="button" variant="secondary" onClick={() => finish(false)}>انصراف</Button>
          <Button type="submit" variant={request.danger ? "danger" : "primary"} disabled={needsReason || needsTyping} autoFocus={!request.reason && !request.typeToConfirm}>{request.confirmLabel || "تأیید"}</Button>
        </div>
      </form>
    </div>
  );
}

/* ───────────── data loading ───────────── */

/**
 * Loads `path` (re-runs when it changes or when reload() is called). `data` keeps the last good answer while a new one
 * loads, so filters never flash an empty page. `every` (ms) refreshes quietly in the background while the tab is visible.
 */
export function useAdminData(path, { every = 0, debounce = 0 } = {}) {
  const [state, setState] = useState({ data: null, error: "", loading: Boolean(path) });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    setState((prev) => ({ ...prev, loading: true }));
    const timer = setTimeout(async () => {
      const result = await api.get(path);
      if (!live) return;
      setState((prev) => (result.ok ? { data: result.payload.data, error: "", loading: false, at: Date.now() } : { ...prev, error: result.payload?.error || "بارگذاری انجام نشد.", loading: false }));
    }, debounce);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [path, tick, debounce]);
  useEffect(() => {
    if (!every) return undefined;
    const timer = setInterval(() => document.visibilityState === "visible" && reload(), every);
    return () => clearInterval(timer);
  }, [every, reload]);
  return { ...state, reload };
}

/** Builds "/path?a=1&b=2", leaving out empty values. */
export function withQuery(path, params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined).map(([key, value]) => [key, String(value)]));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/* ───────────── small pieces ───────────── */

export function Skeleton({ rows = 4, className = "" }) {
  return (
    <div className={`admSkeleton ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => <span key={index} className="uxSkeletonBlock" style={{ width: `${92 - ((index * 17) % 40)}%`, height: index % 3 === 0 ? 18 : 14 }} />)}
    </div>
  );
}

export function Loading({ label = "در حال بارگذاری…" }) {
  return (
    <div className="admLoading" role="status">
      <span className="srOnly">{label}</span>
      <Skeleton rows={5} />
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children }) {
  return (
    <div className="admEmpty">
      <span className="admEmptyIcon"><Icon size={26} aria-hidden="true" /></span>
      <b>{title}</b>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <p className="admError" role="alert">
      {error} {onRetry ? <button type="button" className="admLink" onClick={onRetry}>دوباره امتحان کن</button> : null}
      <button type="button" className="admLink admErrorClaude" onClick={() => askClaude({ kind: "bug", details: `پیام خطای پنل: ${error}` })}><ClaudeMark size={14} /> بده به Claude</button>
    </p>
  );
}

export function Pager({ total, offset, limit, onChange, noun = "مورد" }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;
  return (
    <footer className="admPager">
      <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>قبلی</Button>
      <span>{num(total)} {noun} • صفحهٔ {num(page)} از {num(pages)}</span>
      <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onChange(offset + limit)}>بعدی</Button>
    </footer>
  );
}

/** A row of mutually exclusive filter buttons, each with an optional count. */
export function Segmented({ label, options, value, onChange, size = "md" }) {
  return (
    <div className={`admSeg${size === "sm" ? " is-sm" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.value || "all"} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? "is-on" : ""} onClick={() => onChange(option.value)}>
          {option.icon ? <option.icon size={15} aria-hidden="true" /> : null}
          {option.label}
          {option.count !== undefined ? <i>{num(option.count)}</i> : null}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled = false }) {
  return (
    <label className={`admToggle${disabled ? " is-disabled" : ""}`}>
      <span className="admToggleText">
        <b>{label}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="admToggleTrack" aria-hidden="true"><i /></span>
    </label>
  );
}

export function CopyButton({ text, label = "کپی" }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(text));
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast("کپی نشد؛ دستی انتخاب کن.", "error");
    }
  }
  return (
    <button type="button" className="admIconBtn" onClick={copy} aria-label={done ? "کپی شد" : label} title={done ? "کپی شد" : label}>
      {done ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
    </button>
  );
}

export function Kbd({ children }) {
  return <kbd className="admKbd">{children}</kbd>;
}

/** A card with a title row (and optional actions on the other side). */
export function Card({ title, icon: Icon, actions, children, className = "", ...rest }) {
  return (
    <section className={`admCard ${className}`} {...rest}>
      {title || actions ? (
        <header className="admCardHead">
          {title ? <h2>{Icon ? <Icon size={18} aria-hidden="true" /> : null}{title}</h2> : <span />}
          {actions ? <div className="admCardActions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Saves rows as a CSV that Excel opens with Persian text intact (UTF-8 with BOM). */
export function downloadCsv(rows, filename) {
  if (!rows?.length) {
    toast("ردیفی برای خروجی نیست.", "info");
    return;
  }
  const columns = Object.keys(rows[0]);
  const cell = (value) => {
    const text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Asks the server for an export (password re-check included) and downloads it. */
export async function exportCsv(kind) {
  const result = await api.get(`/api/admin/export?kind=${kind}`);
  if (!result.ok) {
    toast(result.payload?.error || "خروجی گرفته نشد.", "error");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(result.payload.data.rows, `frfro-${kind}-${stamp}.csv`);
  toast(`${num(result.payload.data.rows.length)} ردیف ذخیره شد.`);
}
