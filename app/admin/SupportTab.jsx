"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, CircleCheck, EllipsisVertical, Flag, Info, LifeBuoy, MessageSquare, MessageSquarePlus, Mic, Phone, Plus, Search, Send, StickyNote, X } from "lucide-react";
import { Button, Field } from "../components/ui";
import { api } from "./adminFetch";
import { Avatar } from "./Avatar";
import { CannedReplies } from "./CannedReplies";
import { ClaudeMark, askClaude, setClaudeContext } from "./ClaudeConnect";
import { MessageAttachments } from "../features/support/Attachments";
import { AttachmentField } from "../features/support/Composer";
import { canRecordVoice } from "../features/support/media";
import { CATEGORY_LABEL, PAGE, REASON_LABEL, RESOLUTION_LABEL, ago, fmtDate } from "./format";
import { PageHead } from "./PageHead";
import { EmptyState, ErrorNote, Loading, Pager, Segmented, Skeleton, confirmAction, toast, useAdminData, withQuery } from "./ui";

const labelOf = (ticket) => (ticket.kind === "report" ? REASON_LABEL[ticket.category] : CATEGORY_LABEL[ticket.category]) || ticket.category;
const TEHRAN = { timeZone: "Asia/Tehran" };
const clock = (value) => new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", ...TEHRAN }).format(new Date(value));
const dayKey = (value) => new Intl.DateTimeFormat("en-CA", TEHRAN).format(new Date(value));
const dayTitle = (value) => {
  const key = dayKey(value);
  if (key === dayKey(Date.now())) return "امروز";
  if (key === dayKey(Date.now() - 86400000)) return "دیروز";
  return new Intl.DateTimeFormat("fa-IR", { weekday: "long", month: "long", day: "numeric", ...TEHRAN }).format(new Date(value));
};

/** Plain words about whose turn it is: the thing an admin actually wants to know at a glance. */
function turnOf(ticket) {
  if (ticket.status === "closed") return { key: "closed", label: "بسته" };
  return ticket.last_actor === "user" ? { key: "you", label: "منتظر پاسخ تو" } : { key: "them", label: "منتظر کاربر" };
}

function TurnPill({ ticket }) {
  const turn = turnOf(ticket);
  return <span className={`admPill admTurn is-${turn.key}`}>{turn.label}</span>;
}

/** The messages as a chat: day dividers, bubbles grouped by sender, pictures and voice notes inline. */
function Thread({ messages, userName, isReport, endRef }) {
  const rows = [];
  let lastDay = "";
  messages.forEach((item, index) => {
    const day = dayKey(item.created_at);
    if (day !== lastDay) {
      rows.push(<div key={`day-${day}`} className="admDay"><span>{dayTitle(item.created_at)}</span></div>);
      lastDay = day;
    }
    const prev = messages[index - 1];
    const joined = prev && prev.author === item.author && dayKey(prev.created_at) === day;
    rows.push(
      <div key={item.id} className={`admMsg is-${item.author}${joined ? " is-joined" : ""}`}>
        {item.author === "user" && !joined ? <Avatar name={userName} /> : <span className="admMsgGap" />}
        <div className="admBubble">
          <MessageAttachments items={item.attachments} />
          {item.body ? <p>{item.body}</p> : null}
          <small>{item.author === "admin" ? "پشتیبانی • " : ""}{clock(item.created_at)}</small>
        </div>
      </div>
    );
  });
  return (
    <div className="admThread" aria-live="polite">
      {rows}
      {!messages.length ? <p className="admMuted admThreadEmpty">{isReport ? "کاربر توضیحی ننوشته است." : "هنوز پیامی نیست."}</p> : null}
      <div ref={endRef} />
    </div>
  );
}

/** The "more" menu in a conversation's header: status changes and send-and-close, for a phone where the buttons do not fit. */
function ConvMenu({ items }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  return (
    <div className="admConvMenu" ref={box}>
      <button type="button" className="admIconBtn" aria-label="گزینه‌های بیشتر" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><EllipsisVertical size={18} aria-hidden="true" /></button>
      {open ? (
        <div className="admMenuPop" role="menu">
          {items.map((item) => (
            <button key={item.label} type="button" role="menuitem" disabled={item.disabled} onClick={() => { setOpen(false); item.run(); }}>{item.icon}{item.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One conversation: chat on one tab, the person, what was reported and your private note on the other. */
function Conversation({ id, onChanged, onGo, onBack }) {
  const [found, setFound] = useState(null);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState("chat");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const box = useRef(null);
  const attachRef = useRef(null);
  const [canVoice, setCanVoice] = useState(false);
  useEffect(() => setCanVoice(canRecordVoice()), []);

  const load = useCallback(async () => {
    const { ok, payload } = await api.get(`/api/admin/support/${id}`);
    if (ok) {
      setFound(payload.data);
      setNote(payload.data.ticket.admin_note || "");
    } else setFound({ error: payload.error || "بارگذاری نشد." });
  }, [id]);
  useEffect(() => {
    setFound(null);
    setReply("");
    setFiles([]);
    setTab("chat");
    load();
  }, [load]);
  const count = found?.messages?.length || 0;
  useEffect(() => {
    if (!found?.ticket) return undefined;
    const { ticket: current, messages: all } = found;
    const first = (all[0]?.body || current.body || "").slice(0, 400);
    setClaudeContext("ticket", `گفتگوی پشتیبانی #${current.id} (${current.kind === "report" ? "گزارش" : "پیام"}، دسته: ${current.category}، وضعیت: ${current.status}، موضوع: ${current.subject || "—"}). اولین پیام کاربر: «${first}»`);
    return () => setClaudeContext("ticket", null);
  }, [found]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count, tab]);
  useEffect(() => {
    const area = box.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 180)}px`;
  }, [reply, found]);

  async function send(body, done, after) {
    setBusy(true);
    const { ok, payload } = await api.post(`/api/admin/support/${id}`, body);
    setBusy(false);
    toast(ok ? done : payload.error || "انجام نشد.", ok ? "success" : "error");
    if (ok) {
      after?.();
      await load();
      onChanged();
    }
  }

  const canSend = Boolean(reply.trim() || files.length);
  function sendReply(status) {
    const clear = () => {
      setReply("");
      setFiles([]);
      };
    send({ reply, attachments: files, ...(status ? { status } : {}) }, status ? "پاسخ فرستاده شد و گفتگو بسته شد." : "پاسخ فرستاده شد.", clear);
  }

  if (!found) return <div className="admChatPad"><Loading /></div>;
  if (found.error) return <div className="admChatPad"><ErrorNote error={found.error} onRetry={load} /></div>;
  const { ticket, messages, target } = found;
  const isReport = ticket.kind === "report";
  const phone = ticket.contact_phone || ticket.user_phone;
  const closed = ticket.status === "closed";
  const canReply = Boolean(ticket.user_id);
  const title = ticket.subject || (isReport ? "گزارش" : "پیام");
  return (
    <div className="admConv">
      <header className="admConvHead">
        <button type="button" className="admIconBtn admConvBack" onClick={onBack} aria-label="بازگشت به صندوق"><ArrowRight size={18} aria-hidden="true" /></button>
        <Avatar name={ticket.user_name} phone={phone} />
        <div className="admConvTitle">
          <b>{ticket.user_name || "مهمان (بدون حساب)"}</b>
          <small>{title} • {labelOf(ticket)}</small>
        </div>
        <TurnPill ticket={ticket} />
        <button type="button" className={`admIconBtn admConvInfoBtn${tab === "info" ? " is-on" : ""}`} aria-label="اطلاعات و یادداشت" aria-pressed={tab === "info"} onClick={() => setTab((value) => (value === "info" ? "chat" : "info"))}><Info size={18} aria-hidden="true" /></button>
        <ConvMenu
          items={[
            ...(closed ? [{ label: "بازکردن دوباره", run: () => send({ status: "open" }, "دوباره باز شد.") }, { label: "بده به Claude", icon: <ClaudeMark size={15} />, run: () => askClaude({ kind: "bug" }) }] : [
              ...(ticket.status !== "in_progress" ? [{ label: "در حال بررسی", run: () => send({ status: "in_progress", note }, "در حال بررسی.") }] : []),
              ...(canReply ? [{ label: "ارسال و بستن", disabled: !canSend, run: () => sendReply("closed") }] : []),
              { label: "بده به Claude", icon: <ClaudeMark size={15} />, run: () => askClaude({ kind: "bug" }) },
              { label: "بستن گفتگو", icon: <CircleCheck size={15} aria-hidden="true" />, run: () => send({ status: "closed", note }, "گفتگو بسته شد.") }
            ])
          ]}
        />
        <div className="admConvTools">
          {closed ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ status: "open" }, "دوباره باز شد.")}>بازکردن دوباره</Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ status: "closed", note }, "گفتگو بسته شد.")}><CircleCheck size={15} aria-hidden="true" /> بستن</Button>
            </>
          )}
        </div>
      </header>

      <div className="admConvTabs" role="tablist" aria-label="بخش‌های گفتگو">
        <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "is-on" : ""} onClick={() => setTab("chat")}><MessageSquare size={15} aria-hidden="true" /> گفتگو <i>{count}</i></button>
        <button type="button" role="tab" aria-selected={tab === "info"} className={tab === "info" ? "is-on" : ""} onClick={() => setTab("info")}><Info size={15} aria-hidden="true" /> اطلاعات و یادداشت{note.trim() ? <i className="is-dot" aria-label="یادداشت دارد" /> : null}</button>
      </div>

      {tab === "chat" ? (
        <>
          {isReport && target && !closed ? (
            <div className="admReportStrip">
              <Flag size={15} aria-hidden="true" />
              <span>{ticket.target_type === "post" ? `گزارش پست «${target.title}»` : `گزارش حساب «${target.name || "بدون نام"}»`}</span>
              <button type="button" className="admLink" onClick={() => setTab("info")}>اقدام ←</button>
            </div>
          ) : null}
          <Thread messages={messages} userName={ticket.user_name} isReport={isReport} endRef={endRef} />
          {canReply ? (
            <form className="admComposer" onSubmit={(event) => { event.preventDefault(); sendReply(); }}>
              <div className="admComposeBox">
                <AttachmentField bare value={files} onChange={setFiles} controlRef={attachRef} />
                <Field label="پاسخ به کاربر" hideLabel>
                  {(props) => (
                    <textarea
                      {...props}
                      ref={box}
                      rows={1}
                      maxLength={2000}
                      value={reply}
                      placeholder={closed ? "گفتگو بسته است؛ پاسخ، دوباره بازش می‌کند…" : "پاسخت را بنویس…"}
                      onChange={(event) => setReply(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSend && !busy) {
                          event.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                  )}
                </Field>
                <div className="admComposeBar">
                  <button type="button" className="admRound" aria-label="افزودن عکس" title="افزودن عکس" disabled={files.some((item) => item.kind === "voice") || files.length >= 4} onClick={() => attachRef.current?.pick()}><Plus size={20} aria-hidden="true" /></button>
                  <CannedReplies pill name={ticket.user_name} onPick={(body) => setReply((prev) => (prev ? `${prev}\n${body}` : body))} />
                  <span className="admComposeGap" />
                  {canVoice && !files.length ? <button type="button" className="admRound" aria-label="ضبط پیام صوتی" title="ضبط پیام صوتی" onClick={() => attachRef.current?.record()}><Mic size={19} aria-hidden="true" /></button> : null}
                  <button type="submit" className="admRound is-send" aria-label="ارسال" title="ارسال (Ctrl+Enter)" disabled={busy || !canSend}><ArrowUp size={20} aria-hidden="true" /></button>
                </div>
              </div>
            </form>
          ) : <p className="admMuted admChatPad">این فرستنده حساب ندارد؛ فقط با شمارهٔ تماسش می‌شود جواب داد.</p>}
        </>
      ) : (
        <div className="admConvInfo">
          <button type="button" className="admChipLink admInfoBack" onClick={() => setTab("chat")}><ArrowRight size={15} aria-hidden="true" /> بازگشت به گفتگو</button>
          <section>
            <h3>فرستنده</h3>
            <ul className="admFacts">
              <li>
                <span>حساب</span>
                {ticket.user_id ? <button type="button" className="admLink" onClick={() => onGo("users", { id: ticket.user_id })}>{ticket.user_name || "بدون نام"} ←</button> : <b>مهمان (بدون حساب)</b>}
              </li>
              {phone ? <li><span>شمارهٔ تماس</span><a className="admLink" href={`tel:${phone}`} dir="ltr"><Phone size={14} aria-hidden="true" /> {phone}</a></li> : null}
              <li><span>شروع گفتگو</span><b>{fmtDate(ticket.created_at)}</b></li>
              <li><span>وضعیت</span><b>{closed ? `بسته${ticket.resolution ? ` • ${RESOLUTION_LABEL[ticket.resolution] || ticket.resolution}` : ""}` : ticket.status === "in_progress" ? "در حال بررسی" : "باز"}</b></li>
            </ul>
          </section>

          {isReport ? (
            <section className="admReportBox">
              <h3>مورد گزارش‌شده</h3>
              {target ? (
                <ul className="admFacts">
                  {ticket.target_type === "post" ? (
                    <>
                      <li><span>پست</span><b>{target.title}{target.is_public ? "" : " • پنهان"}</b></li>
                      <li><span>صاحب پست</span><button type="button" className="admLink" onClick={() => onGo("users", { id: target.owner_id })}>{target.owner_name} ←</button></li>
                    </>
                  ) : (
                    <li><span>حساب</span><button type="button" className="admLink" onClick={() => onGo("users", { id: target.id })}>{target.name || "بدون نام"} ←</button></li>
                  )}
                </ul>
              ) : <p className="admMuted">دیگر وجود ندارد (احتمالاً حذف شده).</p>}
              {!closed && target ? (
                <div className="admRowActions">
                  {ticket.target_type === "post" && target.is_public ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ action: "hide_post", note }, "پست پنهان شد و گزارش بسته شد.")}>پنهان‌کردن پست</Button> : null}
                  <Button size="sm" variant="danger" disabled={busy} onClick={async () => (await confirmAction({ title: "حساب مربوط مسدود شود؟", body: "بلافاصله از اپ خارج می‌شود و گزارش بسته می‌شود.", danger: true, confirmLabel: "مسدود شود" })).ok && send({ action: "suspend_user", note }, "حساب مسدود شد و گزارش بسته شد.")}>مسدودکردن حساب</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ action: "dismiss", note }, "گزارش بدون اقدام بسته شد.")}>ایرادی نبود</Button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <h3><StickyNote size={15} aria-hidden="true" /> یادداشت داخلی</h3>
            <p className="admMuted">فقط مدیرها می‌بینند؛ مثلاً: «با تلفن هویتش تأیید شد».</p>
            <Field label="یادداشت" hideLabel>{(props) => <textarea {...props} rows={4} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />}</Field>
            <div className="admRowActions">
              <Button size="sm" variant="secondary" disabled={busy || note === (ticket.admin_note || "")} onClick={() => send({ note }, "یادداشت ذخیره شد.")}>ذخیرهٔ یادداشت</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/** Starts a conversation with any user: find them, write the first message. It lands in their support center. */
function NewChat({ onClose, onCreated }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading } = useAdminData(withQuery("/api/admin/users", { q: q.trim(), limit: 6 }), { debounce: 250 });
  const users = q.trim().length >= 2 ? data?.users || [] : [];
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const { ok, payload } = await api.post("/api/admin/support", { userId: picked.id, subject, message: text });
    setBusy(false);
    if (!ok) return toast(payload?.error || "فرستاده نشد.", "error");
    toast("پیام فرستاده شد؛ در پشتیبانیِ کاربر می‌نشیند.");
    onCreated(payload.data.id);
  }
  return (
    <div className="admModal is-sheet" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="admCard admForm admNewChat" role="dialog" aria-modal="true" aria-labelledby="admNewChatTitle" onSubmit={submit}>
        <div className="admCardHead">
          <h2 id="admNewChatTitle"><MessageSquarePlus size={18} aria-hidden="true" /> گفتگوی تازه</h2>
          <button type="button" className="admIconBtn" onClick={onClose} aria-label="بستن"><X size={16} aria-hidden="true" /></button>
        </div>
        {picked ? (
          <div className="admPicked"><Avatar name={picked.name} phone={picked.phone} /><span><b>{picked.name || "بدون نام"}</b><small dir="ltr">{picked.phone}</small></span><button type="button" className="admLink" onClick={() => setPicked(null)}>تغییر</button></div>
        ) : (
          <>
            <label className="admInlineSearch"><Search size={16} aria-hidden="true" /><input type="search" autoFocus value={q} placeholder="نام یا شمارهٔ کاربر…" aria-label="جست‌وجوی کاربر" onChange={(event) => setQ(event.target.value)} /></label>
            {users.length ? (
              <ul className="admPickList">
                {users.map((user) => (
                  <li key={user.id}><button type="button" onClick={() => setPicked(user)}><Avatar name={user.name} phone={user.phone} /><span><b>{user.name || "بدون نام"}</b><small dir="ltr">{user.phone}</small></span></button></li>
                ))}
              </ul>
            ) : <p className="admMuted">{q.trim().length < 2 ? "دست‌کم دو حرف از نام یا شماره را بنویس." : loading ? "در حال جست‌وجو…" : "کاربری پیدا نشد."}</p>}
          </>
        )}
        {picked ? (
          <>
            <label className="admLabel"><span>موضوع (اختیاری)</span><input type="text" maxLength={120} value={subject} placeholder="مثلاً: دربارهٔ اشتراک سالنت" onChange={(event) => setSubject(event.target.value)} /></label>
            <label className="admLabel"><span>پیام</span><textarea rows={5} maxLength={2000} required value={text} placeholder="سلام، از پشتیبانی فرفرو پیام می‌دهم…" onChange={(event) => setText(event.target.value)} /></label>
            <div className="admRowActions"><CannedReplies name={picked.name} onPick={(body) => setText((prev) => (prev ? `${prev}\n${body}` : body))} /></div>
          </>
        ) : null}
        {picked ? (
          <div className="admDialogActions">
            <Button type="button" variant="ghost" onClick={onClose}>انصراف</Button>
            <Button type="submit" disabled={busy || text.trim().length < 2} loading={busy} loadingLabel="…"><Send size={15} aria-hidden="true" /> ارسال</Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}

const VIEWS = [
  ["admin", "منتظر من"],
  ["user", "منتظر کاربر"],
  ["closed", "بسته"],
  ["all", "همه"]
];

/** The support inbox as a chat app: who is waiting on the right, the conversation beside it, and the tools to deal with reports. */
export function SupportTab({ intent = {}, onChanged, onGo, setParam }) {
  const [view, setView] = useState(intent.id || intent.q ? "all" : "admin");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState(intent.q || "");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(Number(intent.id) || null);
  const [composing, setComposing] = useState(false);

  const params = { kind, q: q.trim(), offset, limit: PAGE };
  if (view === "admin" || view === "user") params.awaiting = view;
  if (view === "closed") params.status = "closed";
  const { data, error, loading, reload } = useAdminData(withQuery("/api/admin/support", params), { debounce: q ? 250 : 0, every: 45 * 1000 });
  useEffect(() => {
    setParam?.("id", selected);
  }, [selected, setParam]);
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && !["INPUT", "TEXTAREA"].includes(event.target.tagName)) setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const changed = () => {
    reload();
    onChanged?.();
  };
  const reset = (fn) => (value) => {
    fn(value);
    setOffset(0);
  };
  const counts = data?.counts || {};
  const tickets = data?.tickets || [];

  return (
    <>
      <PageHead tab="support">
        <Button size="sm" onClick={() => setComposing(true)}><Plus size={16} aria-hidden="true" /> گفتگوی تازه</Button>
      </PageHead>
      <div className={`admChat${selected ? " has-open" : ""}`}>
        <aside className="admChatList" aria-label="صندوق پشتیبانی">
          <div className="admChatFilters">
            <label className="admInlineSearch">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={q} placeholder="موضوع، متن، نام یا شماره…" aria-label="جست‌وجو در پیام‌ها" onChange={(event) => reset(setQ)(event.target.value)} />
            </label>
            <Segmented
              label="نمای صندوق"
              size="sm"
              value={view}
              onChange={reset(setView)}
              options={VIEWS.map(([value, label]) => ({ value, label, count: value === "admin" ? counts.awaiting_admin : value === "user" ? counts.awaiting_user : value === "closed" ? counts.closed : undefined }))}
            />
            <Segmented label="نوع" size="sm" value={kind} onChange={reset(setKind)} options={[{ value: "", label: "همه" }, { value: "support", label: "پیام‌ها" }, { value: "report", label: "گزارش‌ها", icon: Flag }]} />
          </div>
          <ErrorNote error={error} onRetry={reload} />
          {!data && loading ? <Skeleton rows={6} /> : null}
          {data ? (
            tickets.length ? (
              <ul className={`admInbox${loading ? " is-stale" : ""}`}>
                {tickets.map((ticket) => {
                  const turn = turnOf(ticket);
                  return (
                    <li key={ticket.id} className={`${ticket.status === "closed" ? "is-closed" : ""}${selected === ticket.id ? " is-selected" : ""}${turn.key === "you" ? " is-waiting" : ""}`}>
                      <button type="button" onClick={() => setSelected(ticket.id)} aria-current={selected === ticket.id} aria-label={`${ticket.subject || "بدون موضوع"} — ${ticket.user_name || ticket.phone || "مهمان"} — ${turn.label}`}>
                        <span className="admInboxAvatar"><Avatar name={ticket.user_name} phone={ticket.phone} />{ticket.kind === "report" ? <i className="admInboxKind" aria-hidden="true"><Flag size={10} /></i> : null}</span>
                        <span className="admInboxBody">
                          <span className="admInboxTop"><b>{ticket.user_name || "مهمان"}</b><time dateTime={ticket.last_message_at}>{ago(ticket.last_message_at)}</time></span>
                          <span className="admInboxSubject">{ticket.subject || labelOf(ticket)}</span>
                          <small>{ticket.last_body ? ticket.last_body.slice(0, 70) : labelOf(ticket)}</small>
                        </span>
                        {turn.key === "you" ? <span className="admInboxDot" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : view === "admin" ? <EmptyState icon={LifeBuoy} title="همهٔ پیام‌ها پاسخ داده شده‌اند">پیام تازه که بیاید، اینجا و روی زنگ بالای صفحه می‌بینی.</EmptyState> : <EmptyState icon={LifeBuoy} title="موردی نیست">فیلتر را عوض کن یا گفتگوی تازه‌ای شروع کن.</EmptyState>
          ) : null}
          {data ? <Pager total={data.total} offset={offset} limit={PAGE} onChange={setOffset} noun="مورد" /> : null}
        </aside>

        <section className="admChatMain" aria-label="گفتگو">
          {selected ? (
            <Conversation key={selected} id={selected} onChanged={changed} onGo={onGo} onBack={() => setSelected(null)} />
          ) : (
            <div className="admChatBlank">
              <span className="admEmptyIcon"><MessageSquare size={26} aria-hidden="true" /></span>
              <b>یک گفتگو را از صندوق باز کن</b>
              <p>پیام‌ها و گزارش‌های کاربران اینجا مثل یک چت دیده می‌شوند؛ می‌توانی جواب بدهی، عکس و صدا بفرستی و پاسخ آماده بگذاری.</p>
              <Button size="sm" variant="secondary" onClick={() => setComposing(true)}><MessageSquarePlus size={15} aria-hidden="true" /> شروع گفتگو با یک کاربر</Button>
            </div>
          )}
        </section>
      </div>
      <button type="button" className="admFab" aria-label="گفتگوی تازه" onClick={() => setComposing(true)}><Plus size={22} aria-hidden="true" /></button>
      {composing ? <NewChat onClose={() => setComposing(false)} onCreated={(id) => { setComposing(false); setView("all"); setSelected(id); changed(); }} /> : null}
    </>
  );
}
