"use client";

import { useState } from "react";
import { Download, ScrollText, Search } from "lucide-react";
import { Button } from "../components/ui";
import { ACTION_GROUP_LABEL, ACTION_LABEL, ago, fmtDate } from "./format";
import { PageHead } from "./PageHead";
import { EmptyState, ErrorNote, Pager, Segmented, Skeleton, exportCsv, useAdminData, withQuery } from "./ui";

const PAGE_SIZE = 50;
const GROUPS = [{ value: "", label: "همه" }, ...Object.entries(ACTION_GROUP_LABEL).map(([value, label]) => ({ value, label }))];
const TONE = { delete_user: "bad", post_delete: "bad", suspend: "bad", booking_cancel: "bad", login_failed: "bad", login_blocked: "bad", stepup_failed: "bad", enroll_failed: "bad", unsuspend: "good", post_show: "good", login: "good", broadcast: "info", settings_update: "info", export: "warn" };

/** Every admin action, newest first: filter by kind, by admin and by text; each row opens the account it touched. */
export function ActionsTab({ intent = {}, onGo }) {
  const [group, setGroup] = useState(intent.group || "");
  const [adminLabel, setAdminLabel] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const path = withQuery("/api/admin/actions", { group, admin: adminLabel, q: q.trim(), user: intent.user, offset, limit: PAGE_SIZE });
  const { data, error, loading, reload } = useAdminData(path, { debounce: q ? 250 : 0 });
  const reset = (fn) => (value) => {
    fn(value);
    setOffset(0);
  };
  const actions = data?.actions || [];

  return (
    <>
      <PageHead tab="actions">
        <Button variant="secondary" size="sm" onClick={() => exportCsv("actions")}><Download size={16} aria-hidden="true" /> خروجی اکسل</Button>
      </PageHead>
      <section className="admCard admListCard">
        <div className="admToolbar">
          <label className="admInlineSearch">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={q} placeholder="جزئیات، نام یا شمارهٔ کاربر…" aria-label="جست‌وجو در گزارش فعالیت‌ها" onChange={(event) => reset(setQ)(event.target.value)} />
          </label>
          {data?.admins?.length > 1 ? (
            <label className="admSelect">
              <span className="srOnly">مدیر</span>
              <select value={adminLabel} onChange={(event) => reset(setAdminLabel)(event.target.value)}>
                <option value="">همهٔ مدیرها</option>
                {data.admins.map((row) => <option key={row.label} value={row.label}>{row.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <Segmented label="نوع کار" size="sm" value={group} onChange={reset(setGroup)} options={GROUPS} />
        {intent.user ? <p className="admNote">فقط کارهای انجام‌شده روی یک حساب. <button type="button" className="admLink" onClick={() => onGo("actions")}>نمایش همه</button></p> : null}
        <ErrorNote error={error} onRetry={reload} />
        {!data && loading ? <Skeleton rows={8} /> : null}
        {data && !actions.length ? <EmptyState icon={ScrollText} title="موردی نیست" /> : null}
        {actions.length ? (
          <ul className={`admLog${loading ? " is-stale" : ""}`}>
            {actions.map((item) => (
              <li key={item.id}>
                <span className={`admLogDot is-${TONE[item.action] || "muted"}`} aria-hidden="true" />
                <div className="admLogBody">
                  <b>{ACTION_LABEL[item.action] || item.action}</b>
                  {item.target_user_id ? (
                    <button type="button" className="admRowLink" onClick={() => onGo("users", { id: item.target_user_id })}>{item.target_name || item.target_phone || `#${item.target_user_id}`}</button>
                  ) : null}
                  {item.detail ? <p dir="auto">{item.detail}</p> : null}
                </div>
                <div className="admLogMeta">
                  <time dateTime={item.created_at} title={fmtDate(item.created_at)}>{ago(item.created_at)}</time>
                  <small dir="ltr">{item.admin_label || "—"}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {data ? <Pager total={data.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} noun="رویداد" /> : null}
      </section>
    </>
  );
}
