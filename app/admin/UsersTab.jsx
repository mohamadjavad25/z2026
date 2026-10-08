"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { Button, Chip, Field } from "../components/ui";
import { Avatar } from "./Avatar";
import { PAGE, TYPE_LABEL, ago, num } from "./format";
import { PageHead } from "./PageHead";
import { SplitView } from "./SplitView";
import { UserDetail } from "./UserDetail";
import { tabInfo } from "./nav";

/** Accounts: a clean list (click a row) and everything about the selected person beside it. */
export function UsersTab({ intent = {}, onChanged, onGo }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(intent.userId || null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ q, type, offset: String(offset), limit: String(PAGE) });
    const { ok, payload } = await apiFetch(`/api/admin/users?${qs}`);
    if (ok) setData(payload.data);
    setLoading(false);
  }, [q, type, offset]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;
  const info = tabInfo("users");

  const list = (
    <section className="admCard">
      <div className="admFilters">
        <Field label="جستجوی نام یا شماره" hideLabel>
          {(props) => <input {...props} type="search" placeholder="جستجوی نام یا شماره…" value={q} onChange={(event) => { setQ(event.target.value); setOffset(0); }} />}
        </Field>
        <div className="admChips" role="group" aria-label="نوع حساب">
          {[["", "همه"], ["client", "مشتری"], ["artist", "آرتیست"], ["salon", "سالن"]].map(([value, label]) => (
            <Chip key={value || "all"} selected={type === value} onClick={() => { setType(value); setOffset(0); }}>{label}</Chip>
          ))}
        </div>
      </div>
      <div className="admTableWrap">
        <table className="admTable is-clickable">
          <thead>
            <tr><th>کاربر</th><th>نوع</th><th>آخرین بازدید</th><th>وضعیت</th></tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.id} className={`${user.suspended_at ? "is-suspended" : ""}${selected === user.id ? " is-selected" : ""}`} onClick={() => setSelected(user.id)}>
                <td>
                  <span className="admCellUser">
                    <Avatar name={user.name} phone={user.phone} />
                    <span>
                      <button type="button" className="admLink" onClick={(event) => { event.stopPropagation(); setSelected(user.id); }}>{user.name || "—"}</button>
                      <small dir="ltr">{user.phone}</small>
                    </span>
                  </span>
                </td>
                <td><span className={`admPill is-${user.type}`}>{TYPE_LABEL[user.type] || user.type}</span></td>
                <td>{user.last_seen_at ? ago(user.last_seen_at) : "—"}</td>
                <td><span className={`admDot${user.suspended_at ? " is-off" : ""}`}>{user.suspended_at ? "مسدود" : "فعال"}</span></td>
              </tr>
            ))}
            {!data.users.length && !loading ? <tr><td colSpan={4} className="admMuted">کاربری پیدا نشد.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <footer className="admPager">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>قبلی</Button>
        <span>{num(data.total)} کاربر • صفحهٔ {num(page)} از {num(pages)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>بعدی</Button>
      </footer>
    </section>
  );

  return (
    <>
      <PageHead title={info.label} desc={info.desc} />
      <SplitView
        list={list}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        label="جزئیات کاربر"
        emptyHint="روی یک کاربر بزن تا اطلاعات، فعالیت و ابزارهای مدیریتش را ببینی."
        detail={selected ? <UserDetail key={selected} userId={selected} onChanged={() => { load(); onChanged?.(); }} onGo={onGo} /> : null}
      />
    </>
  );
}
