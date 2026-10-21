"use client";

import { useState } from "react";
import { BellRing, Inbox, Megaphone, Send, Smartphone } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { SEGMENT_LABEL, ago, fmtDate, num } from "./format";
import { PageHead } from "./PageHead";
import { SampleChips } from "./SampleChips";
import { BROADCAST_SAMPLES } from "./samples";
import { Card, EmptyState, ErrorNote, Skeleton, Toggle, confirmAction, toast, useAdminData } from "./ui";

const SEGMENT_HINT = {
  all: "همه به‌جز حساب‌های مسدود",
  client: "کسانی که با نقش مشتری ثبت‌نام کرده‌اند",
  pro: "همهٔ سالن‌ها و آرتیست‌ها",
  salon: "فقط حساب‌های سالن",
  artist: "فقط آرتیست‌ها",
  new7: "در ۷ روز گذشته ثبت‌نام کرده‌اند",
  inactive30: "۳۰ روز یا بیشتر اپ را باز نکرده‌اند",
  incomplete: "هنوز خدمتی ثبت نکرده‌اند و کسی نمی‌تواند رزروشان کند"
};

/**
 * One message to a whole group. It can land in each person's support center (they can answer; answers come to the
 * support inbox) and/or as a push notification on their phone. Shows who it reaches before sending, and every past send.
 */
export function BroadcastTab({ intent = {} }) {
  const [segment, setSegment] = useState(SEGMENT_LABEL[intent.segment] ? intent.segment : "all");
  const [inbox, setInbox] = useState(true);
  const [push, setPush] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useAdminData(`/api/admin/broadcast?segment=${segment}`);
  const reach = data?.reach;
  const history = data?.history || [];
  const channels = [inbox && "inbox", push && "push"].filter(Boolean);
  const ready = body.trim().length >= 2 && channels.length && reach?.recipients;

  async function send() {
    const answer = await confirmAction({
      title: `پیام برای ${num(reach.recipients)} نفر فرستاده شود؟`,
      body: `گروه: ${SEGMENT_LABEL[segment]}. ${inbox ? "در صندوق پشتیبانی همه می‌نشیند" : ""}${inbox && push ? " و " : ""}${push ? `برای ${num(reach.withPush)} نفری که اعلان را روشن کرده‌اند اعلان می‌رود` : ""}. فرستاده‌شده پس گرفته نمی‌شود.`,
      confirmLabel: "ارسال"
    });
    if (!answer.ok) return;
    setBusy(true);
    const result = await api.post("/api/admin/broadcast", { segment, channels, title, body, url });
    setBusy(false);
    if (!result.ok) return toast(result.payload?.error || "ارسال نشد.", "error");
    const sent = result.payload.data.broadcast;
    toast(`فرستاده شد: ${num(sent.inboxed)} صندوق${push ? `، ${num(sent.pushed)} اعلان` : ""}.`);
    setTitle("");
    setBody("");
    setUrl("");
    reload();
  }

  return (
    <>
      <PageHead tab="broadcast" />
      <div className="admBroadcast">
        <Card title="پیام تازه" icon={Megaphone}>
          <div className="admForm">
            <SampleChips items={BROADCAST_SAMPLES} onPick={(sample) => { setSegment(sample.segment); setTitle(sample.title); setBody(sample.body); setUrl(sample.url); }} />
            <fieldset className="admSegments">
              <legend>به چه کسانی؟</legend>
              {Object.entries(SEGMENT_LABEL).map(([value, label]) => (
                <label key={value} className={segment === value ? "is-on" : ""}>
                  <input type="radio" name="segment" value={value} checked={segment === value} onChange={() => setSegment(value)} />
                  <b>{label}</b>
                </label>
              ))}
            </fieldset>
            <p className="admSegHint">{SEGMENT_HINT[segment]}</p>
            <div className="admReach" aria-live="polite">
              {reach ? (
                <>
                  <span><b>{num(reach.recipients)}</b> نفر</span>
                  <span><Smartphone size={15} aria-hidden="true" /> {num(reach.withPush)} نفر اعلان را روشن کرده‌اند</span>
                </>
              ) : <span className="admMuted">در حال شمردن…</span>}
            </div>
            <div className="admToggleGrid">
              <Toggle checked={inbox} onChange={setInbox} label="در صندوق پشتیبانی" hint="می‌ماند و می‌توانند جواب بدهند" />
              <Toggle checked={push} onChange={setPush} label="اعلان روی گوشی" hint="فقط اعلان‌روشن‌ها" />
            </div>
            <label className="admLabel">
              <span>عنوان (اختیاری)</span>
              <input type="text" maxLength={120} value={title} placeholder="مثلاً: خبر خوب برای سالن‌ها" onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="admLabel">
              <span>متن پیام</span>
              <textarea rows={5} maxLength={1000} value={body} placeholder="کوتاه و روشن بنویس؛ اعلان گوشی فقط ۱۸۰ حرف اول را نشان می‌دهد." onChange={(event) => setBody(event.target.value)} />
              <small className="admCounter">{num(body.length)} / ۱۰۰۰</small>
            </label>
            {push ? (
              <label className="admLabel">
                <span>با زدن اعلان کجا باز شود؟ (اختیاری)</span>
                <input type="text" dir="ltr" maxLength={300} value={url} placeholder="/" onChange={(event) => setUrl(event.target.value)} />
              </label>
            ) : null}
            <Button disabled={!ready || busy} loading={busy} loadingLabel="در حال ارسال…" onClick={send}><Send size={17} aria-hidden="true" /> ارسال برای {num(reach?.recipients || 0)} نفر</Button>
            <p className="admMuted">برای امنیت، پیش از ارسال رمز عبورت دوباره پرسیده می‌شود. یک پیام تکراری برای همان گروه تا ۵ دقیقه فرستاده نمی‌شود.</p>
          </div>
        </Card>

        <div className="admStack admBroadcastSide">
          <Card title="پیش‌نمایش" icon={BellRing}>
            <div className="admPhone">
              {push ? (
                <div className="admPushMock">
                  <span className="admPushApp">frfro • الان</span>
                  <b>{title || "فرفرو"}</b>
                  <p>{(body || "متن پیام اینجا دیده می‌شود…").slice(0, 180)}</p>
                </div>
              ) : null}
              {inbox ? (
                <div className="admInboxMock">
                  <span><Inbox size={14} aria-hidden="true" /> پشتیبانی فرفرو</span>
                  <b>{title || "پیام از فرفرو"}</b>
                  <p>{body || "متن پیام اینجا دیده می‌شود…"}</p>
                </div>
              ) : null}
              {!channels.length ? <p className="admMuted">دست‌کم یک راه ارسال را روشن کن.</p> : null}
            </div>
          </Card>
          <Card title="پیام‌های فرستاده‌شده" icon={Send}>
            <ErrorNote error={error} onRetry={reload} />
            {!data && !error ? <Skeleton rows={4} /> : null}
            {data && !history.length ? <EmptyState icon={Megaphone} title="هنوز پیام همگانی نفرستاده‌ای" /> : null}
            {history.length ? (
              <ul className="admSent">
                {history.map((row) => (
                  <li key={row.id}>
                    <div>
                      <b>{row.title || row.body.slice(0, 60)}</b>
                      <small>{SEGMENT_LABEL[row.segment] || row.segment} • {num(row.recipients)} نفر{row.channels.includes("push") ? ` • ${num(row.pushed)} اعلان` : ""}</small>
                      {row.title ? <p>{row.body}</p> : null}
                    </div>
                    <time dateTime={row.created_at} title={fmtDate(row.created_at)}>{ago(row.created_at)}</time>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
