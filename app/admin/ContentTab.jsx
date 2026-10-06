"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { adminFetch } from "./adminFetch";
import { Button, Chip, Field } from "../components/ui";
import { PAGE, fmtDate, num } from "./format";

/** Moderation: every post, hide (reversible) or delete (asks for the password again). */
export function ContentTab() {
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ posts: [], total: 0 });
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ q, visibility, offset: String(offset), limit: String(PAGE) });
    const { ok, payload } = await apiFetch(`/api/admin/posts?${qs}`);
    if (ok) setData(payload.data);
  }, [q, visibility, offset]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function act(post, action) {
    if (action === "delete" && !window.confirm(`پست «${post.title}» برای همیشه حذف شود؟`)) return;
    setBusyId(post.id);
    const { ok, payload } = await adminFetch(`/api/admin/posts/${post.id}`, { method: "POST", body: JSON.stringify({ action }) });
    setBusyId(null);
    setMessage(ok ? { hide: "پست پنهان شد.", show: "پست دوباره نمایش داده می‌شود.", delete: "پست حذف شد." }[action] : payload.error || "انجام نشد.");
    if (ok) load();
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;
  return (
    <section className="admCard">
      <div className="admFilters">
        <Field label="جستجو در پست‌ها" hideLabel>
          {(props) => <input {...props} type="search" placeholder="عنوان، توضیح، نام یا شمارهٔ صاحب پست…" value={q} onChange={(event) => { setQ(event.target.value); setOffset(0); }} />}
        </Field>
        <div className="admChips" role="group" aria-label="وضعیت نمایش">
          {[["", "همه"], ["public", "نمایان"], ["hidden", "پنهان"]].map(([value, label]) => (
            <Chip key={value || "all"} selected={visibility === value} onClick={() => { setVisibility(value); setOffset(0); }}>{label}</Chip>
          ))}
        </div>
      </div>
      {message ? <p className="admNote" role="status">{message}</p> : null}
      <div className="admTableWrap">
        <table className="admTable">
          <thead><tr><th>عنوان</th><th>صاحب</th><th>بازدید / ذخیره</th><th>تاریخ</th><th /></tr></thead>
          <tbody>
            {data.posts.map((post) => (
              <tr key={post.id} className={post.is_public ? "" : "is-suspended"}>
                <td>{post.title}{post.is_public ? null : <em> • پنهان</em>}</td>
                <td>{post.owner_name || "—"} <small dir="ltr">{post.owner_phone}</small></td>
                <td>{num(post.views_count)} / {num(post.saves_count)}</td>
                <td>{fmtDate(post.created_at)}</td>
                <td className="admRowActions">
                  <Button size="sm" variant="secondary" loading={busyId === post.id} loadingLabel="…" onClick={() => act(post, post.is_public ? "hide" : "show")}>{post.is_public ? "پنهان" : "نمایش"}</Button>
                  <Button size="sm" variant="danger" disabled={busyId === post.id} onClick={() => act(post, "delete")}>حذف</Button>
                </td>
              </tr>
            ))}
            {!data.posts.length ? <tr><td colSpan={5} className="admMuted">پستی پیدا نشد.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <footer className="admPager">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>قبلی</Button>
        <span>{num(data.total)} پست • صفحهٔ {num(page)} از {num(pages)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>بعدی</Button>
      </footer>
    </section>
  );
}
