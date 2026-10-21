"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, Check, Copy, ExternalLink, GitPullRequest, HelpCircle, Lightbulb, Paintbrush, X } from "lucide-react";
import { Button } from "../components/ui";
import { toast, useAdminData } from "./ui";
import { tabInfo } from "./nav";

/**
 * "Connect to Claude": from anywhere in the panel the admin taps the Claude button, says what is wrong in a line, and
 * gets one ready message with everything Claude needs (which page, which item, the app's latest crashes, the repo and
 * the project rules). It opens in a new Claude chat with the text filled in, or as a GitHub issue, or is copied. The
 * admin sees and can edit the whole text first; phone numbers are masked; nothing leaves the panel until they tap.
 * Pages add details about what is on screen with setClaudeContext (cleared when they close).
 */

const REPO = "mohamadjavad25/z2026";
const store = new Map();
/** A page tells the connector what is on screen (value: short plain text, or null to forget it). */
export function setClaudeContext(key, value) {
  if (value) store.set(key, value);
  else store.delete(key);
}

let openSheet = null;
/** askClaude({ kind, details, note }) opens the sheet from anywhere (an error message, a crash row, a conversation). */
export function askClaude(seed = {}) {
  openSheet?.(seed);
}

/** The Claude spark, drawn in its own orange so it reads as Claude at any size. */
export function ClaudeMark({ size = 18 }) {
  const petals = Array.from({ length: 12 }, (_, index) => index * 30);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="#d97757" transform="translate(12 12)">
        {petals.map((angle, index) => (
          <rect key={angle} x="-1.15" y={index % 2 ? -10.5 : -11.5} width="2.3" height={index % 2 ? 6.5 : 8} rx="1.15" transform={`rotate(${angle})`} />
        ))}
      </g>
    </svg>
  );
}

export function ClaudeButton({ seed, label = "بده به Claude", className = "admChipLink" }) {
  return (
    <button type="button" className={className} onClick={() => askClaude(seed)} title="مشکل را با همهٔ جزئیاتش به Claude بده">
      <ClaudeMark size={15} /> <span className="admBtnText">{label}</span>
    </button>
  );
}

const KINDS = [
  { id: "bug", label: "باگ یا خطا", Icon: Bug, ask: "این مشکل را پیدا کن، علتش را بگو و درستش کن." },
  { id: "design", label: "ظاهر خراب", Icon: Paintbrush, ask: "ظاهر این بخش را بررسی کن و تمیز و درست کن." },
  { id: "idea", label: "امکان تازه", Icon: Lightbulb, ask: "این امکان را طراحی و اضافه کن." },
  { id: "question", label: "سؤال", Icon: HelpCircle, ask: "به این سؤال جواب بده و اگر لازم شد راهنمایی کن." }
];

const mask = (text) => String(text || "").replace(/(?<!\d)(?:\+98|0098|0)?9\d{9}(?!\d)/g, "09*********");

function buildPrompt({ kind, note, page, details, errors, withPage, withDetails, withErrors }) {
  const lines = ["سلام Claude. از پنل ادمین فرفرو (frfro) دارم این را برایت می‌فرستم.", ""];
  lines.push(`## چه می‌خواهم\n${note.trim() || "(توضیح ننوشتم؛ از جزئیات زیر بفهم)"}`, "", `کار: ${KINDS.find((item) => item.id === kind).ask}`, "");
  if (withPage) lines.push(`## کجا\nصفحهٔ «${page.label}» در پنل ادمین (${page.path})${page.size ? `، اندازهٔ صفحه ${page.size}` : ""}.`, "");
  if (withDetails && details.length) lines.push("## جزئیاتِ روی صفحه", ...details.map((line) => `- ${mask(line)}`), "");
  if (withErrors && errors.length) lines.push("## آخرین خطاهای اپ روی گوشی کاربران", ...errors.map((row) => `- ${row.count}× ${mask(row.message)} (${row.source || "?"}${row.url ? `، ${row.url}` : ""})`), "");
  lines.push(`## پروژه\nمخزن گیت‌هاب: ${REPO}. قبل از شروع CLAUDE.md را بخوان و قواعدش را رعایت کن. اگر تغییرِ مهم یا حساس است (مهاجرت، پرداخت، ورود و پیامک، رزرو، دیپلوی) اول بپرس «اول روی ورسل تست کنیم یا مستقیم روی سرور اصلی؟».`);
  return lines.join("\n");
}

/** Mounted once in the shell; the sheet itself. */
export function ClaudeHost({ tab, params }) {
  const [seed, setSeed] = useState(null);
  const [kind, setKind] = useState("bug");
  const [note, setNote] = useState("");
  const [use, setUse] = useState({ page: true, details: true, errors: true });
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    openSheet = (next) => {
      setKind(next.kind || "bug");
      setNote(next.note || "");
      setUse({ page: true, details: true, errors: next.kind ? next.kind === "bug" : true });
      setEdited(false);
      setCopied(false);
      setSeed(next);
    };
    return () => {
      openSheet = null;
    };
  }, []);
  useEffect(() => {
    if (!seed) return undefined;
    const onKey = (event) => event.key === "Escape" && setSeed(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [seed]);

  const { data } = useAdminData(seed && use.errors ? "/api/admin/system" : "");
  const errors = useMemo(() => (data?.errors?.groups || []).slice(0, 5).map((row) => ({ count: row.count, message: String(row.message || "").slice(0, 200), source: row.source, url: row.url })), [data]);
  const details = useMemo(() => (seed ? [...(seed.details ? [].concat(seed.details) : []), ...[...store.values()]] : []), [seed]);
  const page = useMemo(() => {
    if (!seed || typeof window === "undefined") return { label: "", path: "" };
    return { label: tabInfo(tab)?.label || tab, path: `${window.location.pathname}${window.location.search}`, size: `${window.innerWidth}×${window.innerHeight}` };
  }, [seed, tab, params]);

  const built = useMemo(() => (seed ? buildPrompt({ kind, note, page, details, errors, withPage: use.page, withDetails: use.details, withErrors: use.errors }) : ""), [seed, kind, note, page, details, errors, use]);
  useEffect(() => {
    if (!edited) setText(built);
  }, [built, edited]);

  if (!seed) return null;
  const close = () => setSeed(null);
  const open = () => {
    window.open(`https://claude.ai/new?q=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const issue = () => {
    const title = note.trim().split("\n")[0].slice(0, 80) || `${KINDS.find((item) => item.id === kind).label} در پنل ادمین: ${page.label}`;
    window.open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("کپی نشد؛ متن را خودت انتخاب و کپی کن.", "error");
    }
  };
  const long = encodeURIComponent(text).length > 7000;
  return (
    <div className="admModal is-sheet" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="admCard admForm admClaude" role="dialog" aria-modal="true" aria-labelledby="admClaudeTitle">
        <div className="admCardHead">
          <h2 id="admClaudeTitle"><ClaudeMark size={20} /> بده به <bdi>Claude</bdi></h2>
          <button type="button" className="admIconBtn" onClick={close} aria-label="بستن"><X size={16} aria-hidden="true" /></button>
        </div>
        <p className="admMuted">مشکل را یک خط بگو؛ بقیه (کدام صفحه، چه چیزی روی صفحه بود، خطاهای اخیر) خودکار اضافه می‌شود.</p>
        <div className="admClaudeKinds" role="radiogroup" aria-label="نوع درخواست">
          {KINDS.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={kind === id} className={kind === id ? "is-on" : ""} onClick={() => setKind(id)}><Icon size={15} aria-hidden="true" /> {label}</button>
          ))}
        </div>
        <label className="admLabel">
          <span>چه شده؟</span>
          <textarea rows={3} maxLength={1200} autoFocus={!window.matchMedia?.("(pointer: coarse)").matches} value={note} placeholder="مثلاً: وقتی روی «ارسال و بستن» می‌زنم پیام فرستاده می‌شود ولی گفتگو باز می‌ماند." onChange={(event) => { setNote(event.target.value); setEdited(false); }} />
        </label>
        <div className="admClaudeUse" role="group" aria-label="چه چیزهایی همراه شود">
          {[["page", "صفحه‌ای که در آن هستم"], ["details", "جزئیات روی صفحه"], ["errors", "خطاهای اخیر اپ"]].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={use[key]} className={use[key] ? "is-on" : ""} onClick={() => { setUse((prev) => ({ ...prev, [key]: !prev[key] })); setEdited(false); }}>{use[key] ? <Check size={13} aria-hidden="true" /> : null}{label}</button>
          ))}
        </div>
        <details className="admClaudePreview">
          <summary>متنی که فرستاده می‌شود (می‌توانی ویرایشش کنی)</summary>
          <textarea rows={10} dir="auto" value={text} aria-label="متن کامل برای Claude" onChange={(event) => { setText(event.target.value); setEdited(true); }} />
        </details>
        {long ? <p className="admNote">متن بلند است و ممکن است در لینک جا نشود؛ «کپی» را بزن و در Claude بچسبان.</p> : null}
        <div className="admClaudeActions">
          <Button onClick={open}><ClaudeMark size={17} /> باز کردن در <bdi>Claude</bdi> <ExternalLink size={14} aria-hidden="true" /></Button>
          <Button variant="secondary" onClick={issue}><GitPullRequest size={16} aria-hidden="true" /> ساخت <bdi>Issue</bdi> در گیت‌هاب</Button>
          <Button variant="ghost" onClick={copy}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? "کپی شد" : "کپی"}</Button>
        </div>
        <p className="admMuted">شمارهٔ موبایل‌ها پوشانده می‌شود و رمز یا کلیدی همراه نیست. هیچ چیز تا وقتی خودت نزنی فرستاده نمی‌شود.</p>
      </div>
    </div>
  );
}
