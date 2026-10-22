"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Flag, Image as ImageIcon, ImageOff, LayoutGrid, MoreHorizontal, Rows3, Search, Trash2, UserRound, X } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { TYPE_LABEL, ago, fmtDate, num } from "./format";
import { ActionMenu } from "./ActionMenu";
import { PageHead } from "./PageHead";
import { EmptyState, ErrorNote, Pager, Segmented, Skeleton, confirmAction, toastResult, useAdminData, withQuery } from "./ui";

const PAGE_SIZE = 24;
const VIEW_KEY = "frfro_admin_content_view";
const imageOf = (post, full = false) => `/api/admin/posts/${post.id}/image?v=${encodeURIComponent(post.updated_at || post.created_at)}${full ? "&full=1" : ""}`;

function Thumb({ post, full = false }) {
  const [broken, setBroken] = useState(false);
  if (!post.has_image || broken) return <span className="admThumbEmpty"><ImageOff size={22} aria-hidden="true" /></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageOf(post, full)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

/** A post up close: the full picture, its text, who posted it, how many reports, and the actions. */
function PostPreview({ post, onClose, onAct, onGo }) {
  const [menu, setMenu] = useState(false);
  const menuItems = [
    { group: "پست", icon: post.is_public ? EyeOff : Eye, label: post.is_public ? "پنهان‌کردن (برگشت‌پذیر)" : "نمایش دوباره", run: () => onAct([post], post.is_public ? "hide" : "show") },
    { group: "رفتن به", icon: UserRound, label: "حساب صاحب پست", run: () => { onClose(); onGo("users", { id: post.owner_id }); } },
    ...(post.reports ? [{ group: "رفتن به", icon: Flag, label: "دیدن گزارش‌ها", run: () => { onClose(); onGo("support", { q: post.title }); } }] : []),
    { group: "خطرناک", icon: Trash2, label: "حذف دائمی پست", danger: true, run: () => onAct([post], "delete") }
  ];
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="admModal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admCard admPreview" role="dialog" aria-modal="true" aria-label={post.title}>
        <button type="button" className="admIconBtn admPreviewClose" aria-label="بستن" onClick={onClose} autoFocus><X size={18} aria-hidden="true" /></button>
        <div className="admPreviewImage"><Thumb post={post} full /></div>
        <div className="admPreviewBody">
          <h2>{post.title}</h2>
          <p className="admMuted">{post.tag ? `${post.tag} • ` : ""}{fmtDate(post.created_at)}</p>
          {post.caption ? <p className="admPreviewCaption">{post.caption}</p> : null}
          <ul className="admFacts">
            <li><span>صاحب پست</span><button type="button" className="admRowLink" onClick={() => { onClose(); onGo("users", { id: post.owner_id }); }}>{post.owner_name || "بدون نام"} ←</button></li>
            <li><span>نوع حساب</span><b>{TYPE_LABEL[post.owner_type] || "—"}</b></li>
            <li><span>بازدید / ذخیره</span><b>{num(post.views_count)} / {num(post.saves_count)}</b></li>
            <li><span>گزارش</span><b className={post.reports ? "admBadText" : ""}>{post.reports ? `${num(post.reports)} گزارش` : "ندارد"}</b></li>
            <li><span>وضعیت</span><b>{post.is_public ? "نمایان" : "پنهان"}</b></li>
          </ul>
          <div className="admDetailTools">
            <button type="button" className="admChipLink is-primary" onClick={() => setMenu(true)}><MoreHorizontal size={15} aria-hidden="true" /> اقدام‌ها</button>
          </div>
          {menu ? <ActionMenu items={menuItems} onClose={() => setMenu(false)} /> : null}
        </div>
      </section>
    </div>
  );
}

/** Moderation: every post with its picture. Reported ones are one tap away; hide (reversible) or delete (asks for the password again), one or many. */
export function ContentTab({ intent = {}, onGo }) {
  const [q, setQ] = useState(intent.q || "");
  const [visibility, setVisibility] = useState(intent.filter || "");
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState(() => new Set());
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("grid");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {
      // not essential
    }
  }, []);
  function changeView(next) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // not essential
    }
  }

  const path = withQuery("/api/admin/posts", { q: q.trim(), visibility, offset, limit: PAGE_SIZE });
  const { data, error, loading, reload } = useAdminData(path, { debounce: q ? 250 : 0 });
  const posts = data?.posts || [];
  const reset = (fn) => (value) => {
    fn(value);
    setOffset(0);
    setPicked(new Set());
  };

  async function act(targets, action) {
    if (action === "delete") {
      const answer = await confirmAction({
        title: targets.length === 1 ? `پست «${targets[0].title}» حذف شود؟` : `${num(targets.length)} پست حذف شود؟`,
        body: "پست و تصویرش برای همیشه پاک می‌شود. اگر مطمئن نیستی، «پنهان‌کردن» برگشت‌پذیر است.",
        danger: true,
        confirmLabel: "حذف برای همیشه"
      });
      if (!answer.ok) return;
    }
    setBusy(true);
    const result = targets.length === 1
      ? await api.post(`/api/admin/posts/${targets[0].id}`, { action })
      : await api.post("/api/admin/posts/bulk", { ids: targets.map((post) => post.id), action });
    setBusy(false);
    const words = { hide: "پنهان شد", show: "دوباره نمایش داده می‌شود", delete: "حذف شد" };
    if (toastResult(result, targets.length === 1 ? `پست ${words[action]}.` : `${num(result.payload?.data?.changed ?? targets.length)} پست ${words[action]}.`)) {
      setPicked(new Set());
      setOpen(null);
      reload();
    }
  }

  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const pickedPosts = posts.filter((post) => picked.has(post.id));

  return (
    <>
      <PageHead tab="content" />
      <section className="admCard admListCard">
        <div className="admToolbar">
          <label className="admInlineSearch">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={q} placeholder="عنوان، متن، نام یا شمارهٔ صاحب پست…" aria-label="جست‌وجو در پست‌ها" onChange={(event) => reset(setQ)(event.target.value)} />
          </label>
          <Segmented label="وضعیت" size="sm" value={visibility} onChange={reset(setVisibility)} options={[{ value: "", label: "همه" }, { value: "reported", label: "گزارش‌شده", icon: Flag }, { value: "public", label: "نمایان" }, { value: "hidden", label: "پنهان" }]} />
          <Segmented label="نمایش" size="sm" value={view} onChange={changeView} options={[{ value: "grid", label: "", icon: LayoutGrid }, { value: "list", label: "", icon: Rows3 }]} />
        </div>

        {picked.size ? (
          <div className="admBulkBar" role="region" aria-label="کار گروهی">
            <b>{num(picked.size)} پست انتخاب شده</b>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(pickedPosts, "hide")}><EyeOff size={15} aria-hidden="true" /> پنهان</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(pickedPosts, "show")}><Eye size={15} aria-hidden="true" /> نمایش</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => act(pickedPosts, "delete")}><Trash2 size={15} aria-hidden="true" /> حذف</Button>
            <button type="button" className="admIconBtn" aria-label="لغو انتخاب" onClick={() => setPicked(new Set())}><X size={16} aria-hidden="true" /></button>
          </div>
        ) : null}

        <ErrorNote error={error} onRetry={reload} />
        {!data && loading ? <Skeleton rows={6} /> : null}
        {data && !posts.length ? <EmptyState icon={ImageIcon} title={visibility === "reported" ? "پست گزارش‌شده‌ای منتظر نیست" : "پستی پیدا نشد"}>{visibility === "reported" ? "هر گزارشی که بیاید اینجا هم دیده می‌شود." : "فیلترها را تغییر بده."}</EmptyState> : null}

        {posts.length && view === "grid" ? (
          <ul className={`admPostGrid${loading ? " is-stale" : ""}`}>
            {posts.map((post) => (
              <li key={post.id} className={`${post.is_public ? "" : "is-hidden"}${picked.has(post.id) ? " is-picked" : ""}`}>
                <button type="button" className="admPostOpen" onClick={() => setOpen(post)} aria-label={`باز کردن پست ${post.title}`}>
                  <span className="admPostImage"><Thumb post={post} /></span>
                  <span className="admPostMeta">
                    <b>{post.title}</b>
                    <small>{post.owner_name || "—"} • {ago(post.created_at)}</small>
                  </span>
                </button>
                <span className="admPostFlags">
                  {post.reports ? <span className="admTone is-bad"><Flag size={12} aria-hidden="true" /> {num(post.reports)}</span> : null}
                  {post.is_public ? null : <span className="admTone is-muted">پنهان</span>}
                </span>
                <label className="admPostPick">
                  <input type="checkbox" checked={picked.has(post.id)} onChange={() => togglePick(post.id)} aria-label={`انتخاب ${post.title}`} />
                </label>
              </li>
            ))}
          </ul>
        ) : null}

        {posts.length && view === "list" ? (
          <div className={`admTableWrap${loading ? " is-stale" : ""}`}>
            <table className="admTable is-clickable">
              <thead><tr><th className="admCheckCol" /><th>پست</th><th>صاحب</th><th className="admHideNarrow">بازدید / ذخیره</th><th>گزارش</th><th>تاریخ</th></tr></thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className={post.is_public ? "" : "is-suspended"} onClick={() => setOpen(post)}>
                    <td className="admCheckCol" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={picked.has(post.id)} onChange={() => togglePick(post.id)} aria-label={`انتخاب ${post.title}`} /></td>
                    <td><span className="admCellUser"><span className="admMiniThumb"><Thumb post={post} /></span><span>{post.title}{post.is_public ? null : <em> • پنهان</em>}</span></span></td>
                    <td>{post.owner_name || "—"} <small dir="ltr">{post.owner_phone}</small></td>
                    <td className="admHideNarrow">{num(post.views_count)} / {num(post.saves_count)}</td>
                    <td>{post.reports ? <span className="admTone is-bad">{num(post.reports)}</span> : "—"}</td>
                    <td>{fmtDate(post.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data ? <Pager total={data.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} noun="پست" /> : null}
      </section>
      {open ? <PostPreview post={open} onClose={() => setOpen(null)} onAct={act} onGo={onGo} /> : null}
    </>
  );
}
