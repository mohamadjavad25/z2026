"use client";

import { useEffect, useState } from "react";
import { Ban, Download, LogOut, Search, ShieldCheck, Users, X } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { Avatar } from "./Avatar";
import { TYPE_LABEL, ago, num } from "./format";
import { PageHead } from "./PageHead";
import { SplitView } from "./SplitView";
import { UserDetail } from "./UserDetail";
import { EmptyState, ErrorNote, Pager, Segmented, Skeleton, confirmAction, exportCsv, toast, useAdminData, withQuery } from "./ui";

const PAGE_SIZE = 30;
const STATUS = [
  { value: "", label: "همه", key: "all" },
  { value: "online", label: "آنلاین", key: "online" },
  { value: "new", label: "تازه (۷ روز)", key: "new" },
  { value: "inactive", label: "غیرفعال (۳۰ روز)", key: "inactive" },
  { value: "suspended", label: "مسدود", key: "suspended" }
];
const SORTS = [["new", "تازه‌ترین"], ["seen", "آخرین بازدید"], ["name", "نام"], ["old", "قدیمی‌ترین"], ["cancels", "بیشترین لغو توسط سالن"]];

/**
 * Accounts: search, filter by type and status, sort, select several for one action, and everything about one person in the
 * panel beside the list. The open account is in the address bar (?p=users&id=12).
 */
export function UsersTab({ intent = {}, onChanged, onGo, setParam }) {
  const [q, setQ] = useState(intent.q || "");
  const [type, setType] = useState(intent.type || "");
  const [status, setStatus] = useState(intent.status || "");
  const [sort, setSort] = useState("new");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(Number(intent.id) || null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const path = withQuery("/api/admin/users", { q: q.trim(), type, status, sort, offset, limit: PAGE_SIZE });
  const { data, error, loading, reload } = useAdminData(path, { debounce: q ? 250 : 0 });
  const users = data?.users || [];
  const counts = data?.counts || {};

  useEffect(() => {
    setParam?.("id", selected);
  }, [selected, setParam]);

  const filter = (fn) => (value) => {
    fn(value);
    setOffset(0);
    setPicked(new Set());
  };
  const allPicked = users.length > 0 && users.every((user) => picked.has(user.id));
  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(users.map((user) => user.id)));
  }

  async function bulk(action) {
    const ids = [...picked];
    const words = { suspend: "مسدود", unsuspend: "رفع مسدودی", logout: "از همهٔ دستگاه‌ها خارج" };
    const answer = await confirmAction({
      title: `${num(ids.length)} حساب ${words[action]} شود؟`,
      body: action === "suspend" ? "بلافاصله از اپ خارج می‌شوند و تا رفع مسدودی نمی‌توانند وارد شوند. حساب‌های مدیر خودبه‌خود کنار گذاشته می‌شوند." : action === "logout" ? "باید دوباره وارد شوند." : "دوباره می‌توانند وارد شوند.",
      danger: action === "suspend",
      confirmLabel: action === "suspend" ? "مسدود شود" : "انجام شود",
      reason: action === "suspend" ? { label: "دلیل (در گزارش فعالیت‌ها می‌ماند)", placeholder: "مثلاً: اسپم، حساب جعلی" } : null
    });
    if (!answer.ok) return;
    setBusy(true);
    const result = await api.post("/api/admin/users/bulk", { ids, action, reason: answer.reason });
    setBusy(false);
    if (!result.ok) return toast(result.payload?.error || "انجام نشد.", "error");
    const { changed, skipped } = result.payload.data;
    toast(`${num(changed)} حساب انجام شد${skipped ? `؛ ${num(skipped)} حساب تغییری لازم نداشت یا مدیر بود` : ""}.`);
    setPicked(new Set());
    reload();
    onChanged?.();
  }

  const list = (
    <section className="admCard admListCard">
      <div className="admToolbar">
        <label className="admInlineSearch">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={q} placeholder="نام، شماره، ایمیل یا منطقه…" aria-label="جست‌وجوی کاربران" onChange={(event) => filter(setQ)(event.target.value)} />
        </label>
        <Segmented label="نوع حساب" size="sm" value={type} onChange={filter(setType)} options={[{ value: "", label: "همه" }, { value: "client", label: "مشتری" }, { value: "artist", label: "آرتیست" }, { value: "salon", label: "سالن" }]} />
        <label className="admSelect">
          <span className="srOnly">ترتیب</span>
          <select value={sort} onChange={(event) => filter(setSort)(event.target.value)}>
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <Segmented label="وضعیت" size="sm" value={status} onChange={filter(setStatus)} options={STATUS.map((item) => ({ value: item.value, label: item.label, count: counts[item.key] }))} />

      {picked.size ? (
        <div className="admBulkBar" role="region" aria-label="کار گروهی">
          <b>{num(picked.size)} انتخاب شده</b>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => bulk("suspend")}><Ban size={15} aria-hidden="true" /> مسدود</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => bulk("unsuspend")}><ShieldCheck size={15} aria-hidden="true" /> رفع مسدودی</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => bulk("logout")}><LogOut size={15} aria-hidden="true" /> خروج اجباری</Button>
          <button type="button" className="admIconBtn" aria-label="لغو انتخاب" onClick={() => setPicked(new Set())}><X size={16} aria-hidden="true" /></button>
        </div>
      ) : null}

      <ErrorNote error={error} onRetry={reload} />
      {!data && loading ? <Skeleton rows={8} className="is-table" /> : null}
      {data ? (
        users.length ? (
          <div className={`admTableWrap${loading ? " is-stale" : ""}`}>
            <table className="admTable is-clickable">
              <thead>
                <tr>
                  <th className="admCheckCol"><input type="checkbox" aria-label="انتخاب همهٔ این صفحه" checked={allPicked} onChange={toggleAll} /></th>
                  <th>کاربر</th><th>نوع</th><th className="admHideNarrow">منطقه</th><th className="admHideNarrow">آخرین بازدید</th><th title="چند بار نوبت تأییدشدهٔ مشتری را خودش لغو کرده (فقط شمارش)">لغو توسط سالن</th><th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`${user.suspended_at ? "is-suspended" : ""}${selected === user.id ? " is-selected" : ""}`} onClick={() => setSelected(user.id)}>
                    <td className="admCheckCol" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" aria-label={`انتخاب ${user.name || user.phone}`} checked={picked.has(user.id)} onChange={() => togglePick(user.id)} />
                    </td>
                    <td>
                      <span className="admCellUser">
                        <Avatar name={user.name} phone={user.phone} />
                        <span>
                          <button type="button" className="admRowLink" onClick={(event) => { event.stopPropagation(); setSelected(user.id); }}>{user.name || "بدون نام"}</button>
                          <small dir="ltr">{user.phone}</small>
                        </span>
                      </span>
                    </td>
                    <td><span className={`admPill is-${user.type}`}>{TYPE_LABEL[user.type] || user.type}</span></td>
                    <td className="admHideNarrow">{user.area || "—"}</td>
                    <td className="admHideNarrow">{user.last_seen_at ? ago(user.last_seen_at) : "—"}</td>
                    <td className="admCancelCount">{user.type === "client" ? "—" : <b className={user.provider_cancel_count ? "is-some" : ""}>{num(user.provider_cancel_count || 0)}</b>}</td>
                    <td><span className={`admDot${user.suspended_at ? " is-off" : ""}`}>{user.suspended_at ? "مسدود" : "فعال"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Users} title="کاربری پیدا نشد">فیلترها یا جست‌وجو را تغییر بده.</EmptyState>
      ) : null}
      {data ? <Pager total={data.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} noun="کاربر" /> : null}
    </section>
  );

  return (
    <>
      <PageHead tab="users">
        <Button variant="secondary" size="sm" onClick={() => exportCsv("users")}><Download size={16} aria-hidden="true" /> خروجی اکسل</Button>
      </PageHead>
      <SplitView
        list={list}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        label="جزئیات کاربر"
        emptyHint="روی یک کاربر بزن تا اطلاعات، فعالیت و ابزارهای مدیریتش را ببینی."
        detail={selected ? <UserDetail key={selected} userId={selected} onChanged={() => { reload(); onChanged?.(); }} onGo={onGo} onClose={() => setSelected(null)} /> : null}
      />
    </>
  );
}
