"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Clock, Store } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ProfileSheet } from "../profile/ProfileSheet";
import { WeekStrip } from "../team/WeekStrip";
import { hourOnly, overlapHours, weekFromHours, weekSentence } from "../team/teamWeek";
import { SalonRulesNote } from "../salons/SalonRulesNote";
import { getArtistTeamPosts, sendArtistTeamPost } from "../../shared/api/artists";
import { getPosts } from "../../shared/api/posts";
import { toPersianDigits } from "../../shared/lib/digits";

const splitRoles = (role) => String(role || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);

/**
 * What an artist wants to know under a salon's card (owner's choice of 2026-10-28): where their clients go (the caller
 * puts that row first), when and what they do at this salon, who else is there, their posts on its page, and the salon's
 * own facts. Leaving is last and quiet, with the 24-hour rule written out.
 */
export function ArtistSalonDetails({ card, team, leaveBusy, onLeave, onOpenSelf }) {
  if (!team) return null;
  const week = weekFromHours(overlapHours(team.ownHours || [], team.salonHours || []));
  const roles = splitRoles(team.role);
  const mates = team.teammates || [];
  const posts = team.posts || { pending: 0, approved: 0 };
  const salonToday = weekFromHours(team.salonHours || []).find((item) => item.today);
  const away = team.state === "مرخصی";

  return (
    <div className="cwStack">
      <section className="cwCard" aria-label="من اینجا">
        <div className="cwHead">
          <b>من اینجا</b>
          {away ? <span className="cwChip">مرخصی</span> : null}
        </div>
        {team.ownHours?.length ? (
          <>
            <WeekStrip week={week} large />
            <p className="cwSub">{weekSentence(week) || "الان هیچ روزی با ساعت سالن جور نیست."}</p>
          </>
        ) : (
          <p className="cwSub">هنوز ساعت کاریت رو نذاشتی. از تنظیمات بذارش تا مشتری‌ها بدونن کی هستی.</p>
        )}
        {away ? <p className="cwSub">{team.salonName} تو رو مرخصی گذاشته. تا برگردی نوبت تازه نمی‌گیری.</p> : null}
        <div>
          <p className="cwSub" style={{ marginBottom: 6 }}>اینجا این کارها رو می‌کنی</p>
          <div className="cwChips">
            {roles.length ? roles.map((role) => <span key={role} className="cwChip"><ServiceIcon name={role} size="xs" />{role}</span>) : <span className="cwSub">هنوز کارهات رو نگفتی؛ از خدمات خودت بگو.</span>}
          </div>
        </div>
      </section>

      {mates.length ? (
        <section className="cwCard" aria-label="هم‌تیمی‌هام">
          <div className="cwRowBtn" style={{ cursor: "default" }}>
            <span>
              <b>هم‌تیمی‌هام</b>
              <small>{mates.slice(0, 2).map((m) => m.name).join("، ")}{mates.length > 2 ? ` و ${toPersianDigits(mates.length - 2)} نفر دیگه` : ""}</small>
            </span>
            <span className="cwFaces" aria-hidden="true">
              {mates.slice(0, 4).map((m, i) => (m.avatar ? <img key={i} src={m.avatar} alt="" /> : <span key={i}>{String(m.name || "?").slice(0, 1)}</span>))}
            </span>
          </div>
        </section>
      ) : null}

      <section className="cwCard" aria-label="صفحهٔ من توی سالن">
        <button type="button" className="cwRowBtn" onClick={onOpenSelf}>
          <span>
            <b>خودت توی صفحهٔ سالن</b>
            <small>{posts.approved ? `${toPersianDigits(posts.approved)} تا نمونه‌کارت روی صفحهٔ سالنه.` : "ببین مشتری‌ها تو رو اونجا چطور می‌بینن."}</small>
          </span>
          {posts.pending ? <span className="cwChip is-live">{toPersianDigits(posts.pending)} تا منتظره</span> : null}
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      </section>

      <section className="cwCard" aria-label="خود سالن">
        <div className="cwLines">
          <div className="cwLine">
            <span className="cwIco"><Clock size={15} aria-hidden="true" /></span>
            <span>ساعت کاری سالن</span>
            <small>{salonToday?.on ? `امروز ${toPersianDigits(hourOnly(salonToday.open))} تا ${toPersianDigits(hourOnly(salonToday.close))}` : salonToday ? "امروز تعطیله" : "ساعتش رو نذاشته"}</small>
          </div>
          {card.rules ? (
            <div className="cwLine" style={{ display: "block" }}>
              <SalonRulesNote rules={card.rules} />
            </div>
          ) : null}
        </div>
      </section>

      <div className="cwQuiet">
        <button type="button" disabled={leaveBusy} onClick={onLeave}>{leaveBusy ? "یه لحظه…" : `ترک تیم ${card.name}`}</button>
        <small>نوبت‌هایی که تا ۲۴ ساعت دیگه داری، اول باید انجام یا لغو شن.</small>
      </div>
    </div>
  );
}

/**
 * «خودت توی صفحهٔ سالن»: the card clients see for this artist on the salon's page, and which of their posts the salon
 * may show (the same send / take back as the post sheet's «برای صفحهٔ … هم بفرست», owner's decision 2026-10-26).
 */
export function ArtistSelfSheet({ open, team, artistName, onClose, onChanged }) {
  const [posts, setPosts] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const salonId = team?.salonId;

  const load = useCallback(async () => {
    try {
      const [mine, sent] = await Promise.all([getPosts(), getArtistTeamPosts()]);
      setPosts(mine.ok ? mine.data?.posts || [] : []);
      if (sent.ok) setStatuses(sent.data?.statuses || {});
    } catch {
      setPosts([]);
    }
  }, []);
  useEffect(() => { if (open) { setMessage(""); load(); } }, [open, load]);

  if (!team) return null;
  const roles = splitRoles(team.role);
  const statusOf = (postId) => statuses?.[postId]?.[salonId] || "";
  const onPage = (posts || []).filter((post) => statusOf(post.id) === "approved").slice(0, 3);

  async function toggle(post) {
    const status = statusOf(post.id);
    if (busy || status === "declined" || !post.isPublic) return;
    setBusy(String(post.id));
    setMessage("");
    try {
      const result = await sendArtistTeamPost(post.id, salonId, status ? "withdraw" : "send");
      if (result.ok) { setStatuses(result.data?.statuses || {}); onChanged?.(); }
      else setMessage(result.error || result.payload?.error || "نشد؛ دوباره بزن.");
    } catch {
      setMessage("نشد؛ دوباره بزن.");
    } finally {
      setBusy("");
    }
  }

  const hint = (post) => {
    const status = statusOf(post.id);
    if (status === "declined") return `${team.salonName} این پست رو اضافه نکرد.`;
    if (!post.isPublic) return "فقط خودت می‌بینی";
    if (status === "approved") return "روی صفحهٔ سالنه";
    if (status === "pending") return "منتظر جواب سالنه";
    return "روی صفحهٔ سالن نیست";
  };

  return (
    <ProfileSheet open={open} kicker={team.salonName} title="خودت توی صفحهٔ سالن" panelClassName="clwSheet" onClose={onClose}>
      <p className="cwSub">مشتری‌ها تو رو توی صفحهٔ {team.salonName} این‌جوری می‌بینن.</p>
      <div className="cwSelfPreview">
        <div className="cwSelfTop">
          <span><Store size={20} aria-hidden="true" /></span>
          <div style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: "0.92rem" }}>{artistName || "من"}</b>
            <div className="cwChips">{roles.map((role) => <span key={role} className="cwChip">{role}</span>)}</div>
          </div>
        </div>
        <div className="cwSelfPosts">
          {[0, 1, 2].map((i) => <span key={i}>{onPage[i]?.image ? <img src={onPage[i].image} alt="" /> : null}</span>)}
        </div>
        <div className="cwSelfBook">رزرو با {String(artistName || "من").split(" ")[0]}</div>
      </div>

      <section className="cwCard">
        <b style={{ fontSize: "0.88rem" }}>کدوم پست‌هات روی صفحهٔ سالن باشن؟</b>
        {posts === null ? <p className="cwSub">یه لحظه…</p> : posts.length ? (
          <div>
            {posts.map((post) => {
              const status = statusOf(post.id);
              const on = status === "approved" || status === "pending";
              return (
                <div className="cwPostRow" key={post.id}>
                  {post.image ? <img src={post.image} alt="" /> : <i aria-hidden="true" />}
                  <span>
                    <b>{post.title || post.caption || "نمونه‌کار"}</b>
                    <small className={status === "pending" ? "is-live" : ""}>{hint(post)}</small>
                  </span>
                  <button
                    type="button"
                    className="plSwitch"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${post.title || "نمونه‌کار"} برای صفحهٔ ${team.salonName}`}
                    disabled={Boolean(busy) || status === "declined" || !post.isPublic}
                    onClick={() => toggle(post)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="cwSub">هنوز نمونه‌کاری نذاشتی. از تب «نمونه‌کار» یکی بذار، بعد برای این سالن بفرستش.</p>
        )}
        {message ? <p className="cwSub" role="alert" style={{ color: "var(--danger)" }}>{message}</p> : null}
        <p className="cwSub">پست وقتی روی صفحهٔ سالن میاد که سالن قبولش کنه. تا ۱۰ تا پست می‌تونن هم‌زمان منتظر جواب باشن.</p>
      </section>
    </ProfileSheet>
  );
}
