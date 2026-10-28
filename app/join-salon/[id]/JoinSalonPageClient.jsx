"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { getAuthMe } from "../../shared/api/auth";
import { joinSalonWithTerms, sendJoinProposal } from "../../shared/api/joinTerms";
import { JoinTermsSheet } from "./JoinTermsSheet";

const PENDING_JOIN_KEY = "frfro_pending_join_salon";
const RETRY = "نشد؛ دوباره بزن.";

// The app, not the about page: a client-side navigation does not re-run the root layout's head script.
function enterApp(router, href = "/") {
  document.documentElement.classList.add("skip-landing");
  router.push(href);
}

/**
 * QR/link landing page (app/join-salon/[id]) — the short «برگه» an artist reads before joining a salon's team:
 * her share, days and hours, the salon's rules and a calm promise line; then «قبول دارم» or her own offer.
 * Standalone and auth-agnostic: a guest reads the same paper, then signs in (the join fires after login).
 */
export function JoinSalonPageClient({ salon, joinCode = "" }) {
  const router = useRouter();
  const [status, setStatus] = useState("checking");
  const [terms, setTerms] = useState(salon.terms || null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAuthMe()
      .then(({ ok, data }) => {
        if (cancelled) return;
        const user = ok ? data?.user : null;
        setStatus(!user ? "guest" : user.type !== "artist" ? "wrong-role" : "ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const base = { salonUserId: salon.id, code: joinCode, termsVersion: terms?.version };

  // One place for both calls: 409 TERMS_CHANGED redraws the paper with the fresh terms.
  async function submit(request, doneStatus) {
    setStatus("joining");
    setNotice("");
    try {
      const result = await request();
      const payload = result.payload || {};
      if (result.ok || payload.code === "ALREADY_STAFF") {
        setStatus(doneStatus);
      } else if (result.status === 409 && payload.code === "TERMS_CHANGED") {
        if (payload.terms) setTerms(payload.terms);
        setNotice("شرایط سالن عوض شده. دوباره بخونش.");
        setStatus("ready");
      } else {
        setNotice(payload.error || RETRY);
        setStatus("ready");
      }
    } catch {
      setNotice(RETRY);
      setStatus("ready");
    }
  }

  const handleJoin = () => submit(() => joinSalonWithTerms(base), "joined");
  const handlePropose = (proposal) => submit(() => sendJoinProposal({ ...base, ...proposal }), "proposed");

  function handleGuestContinue() {
    try {
      window.localStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ id: salon.id, code: joinCode, termsVersion: terms?.version ?? null }));
    } catch {
      // ignore — the join simply won't auto-fire after login
    }
    const version = terms?.version != null ? `&v=${encodeURIComponent(terms.version)}` : "";
    enterApp(router, `/?join=${salon.id}&k=${encodeURIComponent(joinCode)}${version}`);
  }

  const paper = status === "ready" || status === "joining" || status === "guest";
  return (
    <div className="joinSalonPage">
      <div className={`joinSalonCard${paper && salon.ready && terms ? " is-paper" : ""}`}>
        <div className={`joinSalonAvatar ${salon.avatar ? "hasImage" : ""}`}>
          {salon.avatar ? <img src={salon.avatar} alt="" /> : <Sparkles size={26} />}
        </div>
        <span className="joinSalonKicker">دعوت به تیم</span>
        <h1>{salon.name}</h1>
        {salon.area ? <p className="joinSalonArea">{salon.area}</p> : null}

        {status === "checking" ? (
          <p className="joinSalonHint">یه لحظه…</p>
        ) : !salon.ready || !terms ? (
          <>
            <p className="joinSalonHint is-warning">این لینک هنوز آماده نیست.</p>
            <p className="joinSalonHint">از سالن بخواه شرایط همکاری رو ذخیره کنه و لینک تازه بفرسته.</p>
          </>
        ) : status === "wrong-role" ? (
          <>
            <p className="joinSalonHint is-warning">این لینک مال آرتیست‌هاست؛ با حساب آرتیستت وارد شو.</p>
            <button type="button" className="joinSalonAction is-secondary" onClick={() => router.push("/")}>
              برو به فرفرو
            </button>
          </>
        ) : status === "joined" || status === "proposed" ? (
          <div className="joinSalonSuccess">
            <CheckCircle2 size={28} aria-hidden="true" />
            {status === "joined" ? (
              <b>اومدی توی تیم «{salon.name}»!</b>
            ) : (
              <>
                <b>پیشنهادت رفت برای {salon.name}. تا جواب نده، هنوز تو تیم نیستی.</b>
                <p className="joinSalonHint">پیشنهادت ۷ روز اعتبار داره.</p>
              </>
            )}
            <button type="button" className="joinSalonAction" onClick={() => enterApp(router)}>
              برو به خونه
            </button>
          </div>
        ) : (
          <JoinTermsSheet
            salonName={salon.name}
            terms={terms}
            rulesLines={salon.rulesLines || []}
            guest={status === "guest"}
            busy={status === "joining"}
            notice={notice}
            onAccept={status === "guest" ? handleGuestContinue : handleJoin}
            onPropose={handlePropose}
          />
        )}
      </div>
    </div>
  );
}
