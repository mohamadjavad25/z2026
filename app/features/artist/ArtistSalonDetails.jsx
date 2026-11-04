"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Store } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ProfileSheet } from "../profile/ProfileSheet";
import { WeekStrip } from "../team/WeekStrip";
import { daysMismatch, hourOnly, keyLabel, overlapHours, weekFromHours, weekSentence } from "../team/teamWeek";
import { SalonRulesNote } from "../salons/SalonRulesNote";
import { TeamTermsCard } from "../team/TeamTermsCard";
import { TeamLedgerSheet } from "../team/TeamLedgerSheet";
import { getArtistTeamPosts, sendArtistTeamPost } from "../../shared/api/artists";
import { getTeamTerms } from "../../shared/api/team";
import { getPosts } from "../../shared/api/posts";
import { toPersianDigits } from "../../shared/lib/digits";

const splitRoles = (role) => String(role || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
/** «سهمت ۶۰٪، از مشتری خودت ۷۰٪» from the agreed terms; "" when no share is agreed. */
function shareLine(current) {
  if (!current || !Number.isInteger(current.share)) return "";
  const own = Number.isInteger(current.ownShare) && current.ownShare !== current.share ? `، از مشتری خودت ${toPersianDigits(current.ownShare)}٪` : "";
  return `سهمت ${toPersianDigits(current.share)}٪${own}`;
}

/**
 * An artist's page for one salon she works at (owner's decisions of 2026-10-28 and 2026-11-04): where her clients go (the
 * caller puts that row first), then one «من اینجا» card that says the days, hours and share once, and a short list that
 * opens each of the rest (terms, the account, herself on the salon's page, the salon's hours and rules). Leaving is last
 * and quiet, with the 24-hour rule written out.
 */
export function ArtistSalonDetails({ card, team, leaveBusy, onLeave, onOpenSelf }) {
  const [open, setOpen] = useState(""); // "" | terms | ledger | salon
  const [terms, setTerms] = useState(null);
  const salonId = team?.salonId;
  const loadTerms = useCallback(async () => {
    try {
      const result = await getTeamTerms({ salonUserId: salonId });
      if (result.ok) setTerms(result.data);
    } catch {
      // the share line waits for the next open
    }
  }, [salonId]);
  useEffect(() => { if (salonId) loadTerms(); }, [salonId, loadTerms]);
  if (!team) return null;
  const week = weekFromHours(overlapHours(team.ownHours || [], team.salonHours || []));
  const roles = splitRoles(team.role);
  const mates = team.teammates || [];
  const posts = team.posts || { pending: 0, approved: 0 };
  const salonWeek = weekFromHours(team.salonHours || []);
  const salonToday = salonWeek.find((item) => item.today);
  const away = team.state === "مرخصی";
  const current = terms?.current || null;
  const agreed = Boolean(current && (current.days || current.from || Number.isInteger(current.share)));
  const newFromSalon = Boolean(terms?.pending && terms.pending.by !== terms.side);
  const share = shareLine(current);
  const mismatch = team.ownHours?.length ? daysMismatch(week, current?.days) : "";
  const close = () => setOpen("");

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
            <p className="cwSub">{[weekSentence(week) || "الان هیچ روزی با ساعت سالن جور نیست.", share].filter(Boolean).join(" · ")}</p>
            {mismatch ? <p className="cwSub cwWarn">{mismatch}</p> : null}
          </>
        ) : (
          <p className="cwSub">هنوز ساعت کاریت رو نذاشتی؛ از تنظیمات بذارش.</p>
        )}
        {away ? <p className="cwSub">{team.salonName} تو رو مرخصی گذاشته. تا برگردی نوبت تازه نمی‌گیری.</p> : null}
        <div className="cwChips">
          {roles.length ? roles.map((role) => <span key={role} className="cwChip"><ServiceIcon name={role} size="xs" />{role}</span>) : <span className="cwSub">هنوز کارهات رو نگفتی؛ از خدمات خودت بگو.</span>}
        </div>
      </section>

      <section className="cwCard cwList" aria-label={`کار با ${card.name}`}>
        <button type="button" className={`cwRowBtn${newFromSalon ? " is-live" : ""}`} onClick={() => setOpen("terms")}>
          <span>
            <b>{newFromSalon ? `${card.name} شرایط تازه پیشنهاد داده` : "شرایط کار"}</b>
            <small>
              {newFromSalon ? "ببین و جواب بده"
                : agreed ? `${current.effectiveFrom ? `از ${keyLabel(current.effectiveFrom)} · ` : ""}پیشنهاد تغییر هم از اینجاست`
                : "هنوز شرایطی ثبت نشده؛ پیشنهاد بده"}
            </small>
          </span>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="cwRowBtn" onClick={() => setOpen("ledger")}>
          <span>
            <b>حساب من با {card.name}</b>
            <small>کارهای انجام‌شده، سهم هر کس و تصفیه</small>
          </span>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="cwRowBtn" onClick={onOpenSelf}>
          <span>
            <b>خودت توی صفحهٔ سالن</b>
            <small>{posts.approved ? `${toPersianDigits(posts.approved)} تا نمونه‌کارت روی صفحهٔ سالنه` : "ببین مشتری‌ها تو رو اونجا چطور می‌بینن"}</small>
          </span>
          {posts.pending ? <span className="cwChip is-live">{toPersianDigits(posts.pending)} تا منتظره</span> : null}
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="cwRowBtn" onClick={() => setOpen("salon")}>
          <span>
            <b>ساعت و قوانین سالن</b>
            <small>{salonToday?.on ? `امروز ${toPersianDigits(hourOnly(salonToday.open))} تا ${toPersianDigits(hourOnly(salonToday.close))}` : salonToday && salonWeek.some((item) => item.on) ? "امروز تعطیله" : "ساعتش رو نذاشته"}</small>
          </span>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        {mates.length ? (
          <div className="cwRowBtn" style={{ cursor: "default" }}>
            <span>
              <b>هم‌تیمی‌هام</b>
              <small>{mates.slice(0, 2).map((m) => m.name).join("، ")}{mates.length > 2 ? ` و ${toPersianDigits(mates.length - 2)} نفر دیگه` : ""}</small>
            </span>
            <span className="cwFaces" aria-hidden="true">
              {mates.slice(0, 4).map((m, i) => (m.avatar ? <img key={i} src={m.avatar} alt="" /> : <span key={i}>{String(m.name || "?").slice(0, 1)}</span>))}
            </span>
          </div>
        ) : null}
      </section>

      <div className="cwQuiet">
        <button type="button" disabled={leaveBusy} onClick={onLeave}>{leaveBusy ? "یه لحظه…" : `ترک تیم ${card.name}`}</button>
        <small>نوبت‌هایی که تا ۲۴ ساعت دیگه داری، اول باید انجام یا لغو شن.</small>
      </div>

      <ProfileSheet open={open === "terms"} kicker={card.name} title="شرایط کار" panelClassName="clwSheet" onClose={close}>
        <TeamTermsCard pair={{ salonUserId: team.salonId }} otherName={card.name} onChanged={loadTerms} hideHead />
      </ProfileSheet>
      <TeamLedgerSheet open={open === "ledger"} pair={{ salonUserId: team.salonId }} otherName={card.name} onClose={close} />
      <ProfileSheet open={open === "salon"} kicker={card.name} title="ساعت و قوانین سالن" panelClassName="clwSheet" onClose={close}>
        {salonWeek.some((item) => item.on) ? (
          <>
            <WeekStrip week={salonWeek} large />
            <p className="cwSub">{weekSentence(salonWeek)}</p>
          </>
        ) : <p className="cwSub">{card.name} هنوز ساعت کاریش رو نذاشته.</p>}
        {card.rules ? <SalonRulesNote rules={card.rules} open /> : <p className="cwSub">قانون خاصی ننوشته.</p>}
      </ProfileSheet>
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
        <p className="cwSub">هر پست وقتی سالن قبولش کنه روی صفحه‌ش میاد؛ هم‌زمان تا ۱۰ تا می‌تونن منتظر باشن.</p>
      </section>
    </ProfileSheet>
  );
}
