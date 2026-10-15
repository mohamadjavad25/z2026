"use client";

import { useEffect, useRef, useState } from "react";
import { Info, MessageSquareQuote, Megaphone, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { forgetCannedReplies } from "./CannedReplies";
import { ago } from "./format";
import { PageHead } from "./PageHead";
import { Card, ErrorNote, Loading, Segmented, Toggle, confirmAction, toastResult, useAdminData } from "./ui";

const TONES = [{ value: "info", label: "خبر" }, { value: "success", label: "خوش‌خبری" }, { value: "warning", label: "هشدار" }];
const AUDIENCES = [{ value: "all", label: "همه" }, { value: "client", label: "مشتری‌ها" }, { value: "pro", label: "سالن و آرتیست" }];

const Saved = ({ setting }) => (setting?.updatedAt ? <small className="admMuted">آخرین تغییر {ago(setting.updatedAt)}{setting.updatedBy ? <> • <span dir="ltr">{setting.updatedBy}</span></> : null}</small> : null);

async function save(key, value, success) {
  const result = await api.put("/api/admin/settings", { key, value });
  return toastResult(result, success) ? result.payload.data[key] : null;
}

/** The bar at the top of the app: text, tone, who sees it and an optional link, with a live preview. */
function NoticeCard({ initial, focus }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "start" });
  }, [focus]);
  const set = (key) => (next) => setValue((prev) => ({ ...prev, [key]: next }));
  const dirty = JSON.stringify(pick(value)) !== JSON.stringify(pick(saved));
  async function submit(next = value) {
    setBusy(true);
    const result = await save("notice", pick(next), next.enabled ? "اعلان ذخیره شد و برای کاربران دیده می‌شود." : "اعلان خاموش است.");
    setBusy(false);
    if (result) {
      setValue(result);
      setSaved(result);
    }
  }
  return (
    <Card title="اعلان بالای اپ" icon={Megaphone} id="notice" ref={ref} actions={<Saved setting={saved} />}>
      <p className="admMuted">یک نوار کوتاه بالای اپ برای همه یا یک گروه: خبر تازه، قطعی برنامه‌ریزی‌شده، یا جشنواره. کاربر می‌تواند آن را ببندد؛ با هر تغییر متن دوباره دیده می‌شود.</p>
      <div className={`admNoticePreview is-${value.tone}${value.enabled ? "" : " is-off"}`} aria-label="پیش‌نمایش اعلان">
        <Info size={16} aria-hidden="true" />
        <span>{value.text || "متن اعلان اینجا دیده می‌شود."}</span>
        {value.link && value.linkLabel ? <u>{value.linkLabel}</u> : null}
      </div>
      <div className="admForm">
        <Toggle checked={value.enabled} onChange={(enabled) => (dirty ? set("enabled")(enabled) : submit({ ...value, enabled }))} label={value.enabled ? "روشن است" : "خاموش است"} hint={dirty ? "پس از ذخیره اعمال می‌شود" : "با زدن، همین الان روشن یا خاموش می‌شود"} disabled={busy || (!value.enabled && value.text.trim().length < 3)} />
        <label className="admLabel">
          <span>متن اعلان</span>
          <textarea rows={2} maxLength={240} value={value.text} placeholder="مثلاً: جمعه ساعت ۲ تا ۳ بامداد برای به‌روزرسانی، اپ چند دقیقه در دسترس نیست." onChange={(event) => set("text")(event.target.value)} />
        </label>
        <div className="admFormRow">
          <div className="admLabel"><span>حالت</span><Segmented label="حالت اعلان" size="sm" value={value.tone} onChange={set("tone")} options={TONES} /></div>
          <div className="admLabel"><span>برای چه کسانی</span><Segmented label="مخاطب اعلان" size="sm" value={value.audience} onChange={set("audience")} options={AUDIENCES} /></div>
        </div>
        <div className="admFormRow">
          <label className="admLabel"><span>پیوند (اختیاری)</span><input type="text" dir="ltr" maxLength={300} value={value.link} placeholder="/download یا https://…" onChange={(event) => set("link")(event.target.value)} /></label>
          <label className="admLabel"><span>متن دکمهٔ پیوند</span><input type="text" maxLength={40} value={value.linkLabel} placeholder="بیشتر بخوان" onChange={(event) => set("linkLabel")(event.target.value)} /></label>
        </div>
        <div className="admRowActions">
          <Button disabled={!dirty || busy} loading={busy} loadingLabel="…" onClick={() => submit()}>ذخیرهٔ اعلان</Button>
          {dirty ? <Button variant="ghost" onClick={() => setValue(saved)}>برگرداندن</Button> : null}
        </div>
      </div>
    </Card>
  );
}
const pick = ({ enabled, text, tone, audience, link, linkLabel }) => ({ enabled, text, tone, audience, link, linkLabel });

/** New accounts per role. Closing one asks for confirmation; the message is what people see when they try. */
function SignupsCard({ initial, focus }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "start" });
  }, [focus]);
  async function submit(next) {
    if (["client", "artist", "salon"].some((role) => value[role] && !next[role])) {
      const answer = await confirmAction({ title: "ثبت‌نام بسته شود؟", body: "کسانی که الان حساب دارند مثل قبل کار می‌کنند؛ فقط حساب تازه ساخته نمی‌شود.", danger: true, confirmLabel: "بسته شود" });
      if (!answer.ok) return;
    }
    setBusy(true);
    const result = await save("signups", { client: next.client, artist: next.artist, salon: next.salon, message: next.message }, "تنظیم ثبت‌نام ذخیره شد.");
    setBusy(false);
    if (result) setValue(result);
  }
  const closed = ["client", "artist", "salon"].filter((role) => !value[role]);
  return (
    <Card title="ثبت‌نام کاربران تازه" icon={UserPlus} id="signups" ref={ref} actions={<Saved setting={value} />}>
      <p className="admMuted">برای وقتی که سیل حساب جعلی آمده یا یک نقش هنوز آماده نیست. ورود حساب‌های موجود دست نمی‌خورد.</p>
      {closed.length ? <p className="admError admBanner">ثبت‌نام {closed.map((role) => ({ client: "مشتری", artist: "آرتیست", salon: "سالن" })[role]).join("، ")} الان بسته است.</p> : null}
      <div className="admForm">
        <Toggle checked={value.client} disabled={busy} onChange={(on) => submit({ ...value, client: on })} label="مشتری‌ها" />
        <Toggle checked={value.artist} disabled={busy} onChange={(on) => submit({ ...value, artist: on })} label="آرتیست‌ها" />
        <Toggle checked={value.salon} disabled={busy} onChange={(on) => submit({ ...value, salon: on })} label="سالن‌ها" />
        <label className="admLabel">
          <span>پیامی که موقع بسته‌بودن می‌بینند</span>
          <input type="text" maxLength={200} value={value.message} placeholder="ثبت‌نام جدید فعلاً بسته است. کمی بعد دوباره سر بزن." onChange={(event) => setValue({ ...value, message: event.target.value })} />
        </label>
        <div className="admRowActions"><Button variant="secondary" disabled={busy} onClick={() => submit(value)}>ذخیرهٔ پیام</Button></div>
      </div>
    </Card>
  );
}

/** Saved answers for support: add, edit, remove. They appear as one-tap buttons above every reply box. */
function RepliesCard({ initial }) {
  const [items, setItems] = useState(initial.items || []);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  async function persist(next, success) {
    setBusy(true);
    const result = await save("replies", { items: next }, success);
    setBusy(false);
    if (result) {
      setItems(result.items);
      forgetCannedReplies();
      setEditing(null);
    }
  }
  function submitEdit(event) {
    event.preventDefault();
    const entry = { ...editing, title: editing.title.trim(), body: editing.body.trim() };
    const exists = items.some((item) => item.id === entry.id);
    persist(exists ? items.map((item) => (item.id === entry.id ? entry : item)) : [...items, entry], "پاسخ آماده ذخیره شد.");
  }
  async function remove(item) {
    const answer = await confirmAction({ title: `«${item.title}» پاک شود؟`, danger: true, confirmLabel: "پاک شود" });
    if (answer.ok) persist(items.filter((entry) => entry.id !== item.id), "پاک شد.");
  }
  return (
    <Card title="پاسخ‌های آماده" icon={MessageSquareQuote} actions={<Button size="sm" variant="secondary" onClick={() => setEditing({ id: Math.random().toString(36).slice(2, 10), title: "", body: "" })}><Plus size={15} aria-hidden="true" /> پاسخ تازه</Button>}>
      <p className="admMuted">جواب‌هایی که زیاد می‌نویسی (سلام و تشکر، راهنمای افزودن خدمت، …). در پشتیبانی و پیام به کاربر با یک ضربه اضافه می‌شوند.</p>
      {editing ? (
        <form className="admForm admEditBox" onSubmit={submitEdit}>
          <label className="admLabel"><span>عنوان کوتاه (روی دکمه)</span><input type="text" maxLength={60} required value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} autoFocus /></label>
          <label className="admLabel"><span>متن</span><textarea rows={4} maxLength={2000} required value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} /></label>
          <div className="admRowActions">
            <Button type="submit" size="sm" disabled={busy || !editing.title.trim() || editing.body.trim().length < 2}>ذخیره</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
          </div>
        </form>
      ) : null}
      {items.length ? (
        <ul className="admReplies">
          {items.map((item) => (
            <li key={item.id}>
              <div><b>{item.title}</b><p>{item.body}</p></div>
              <span className="admRowActions">
                <button type="button" className="admIconBtn" aria-label={`ویرایش ${item.title}`} onClick={() => setEditing(item)}><Pencil size={15} aria-hidden="true" /></button>
                <button type="button" className="admIconBtn is-danger" aria-label={`پاک‌کردن ${item.title}`} onClick={() => remove(item)}><Trash2 size={15} aria-hidden="true" /></button>
              </span>
            </li>
          ))}
        </ul>
      ) : !editing ? <p className="admMuted">هنوز پاسخ آماده‌ای نساخته‌ای.</p> : null}
    </Card>
  );
}

/** Settings the operator changes without a deploy. Each card saves on its own. */
export function SettingsTab({ intent = {} }) {
  const { data, error, reload } = useAdminData("/api/admin/settings");
  return (
    <>
      <PageHead tab="settings" />
      {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />) : (
        <div className="admTwo is-even">
          <NoticeCard initial={data.notice} focus={intent.focus === "notice"} />
          <div className="admStack">
            <SignupsCard initial={data.signups} focus={intent.focus === "signups"} />
            <RepliesCard initial={data.replies} />
          </div>
        </div>
      )}
    </>
  );
}
