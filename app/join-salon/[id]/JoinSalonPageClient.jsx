"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { SalonRulesNote } from "../../features/salons/SalonRulesNote";
import { getAuthMe } from "../../shared/api/auth";

const PENDING_JOIN_KEY = "frfro_pending_join_salon";

// The app, not the about page: a client-side navigation does not re-run the root layout's head script.
function enterApp(router, href = "/") {
  document.documentElement.classList.add("skip-landing");
  router.push(href);
}

/**
 * QR/link landing page (app/join-salon/[id]) — standalone, auth-agnostic.
 * Salon shows this as a QR code (see SalonNearbyInviteSheet's artistInviteQrCard);
 * an artist scanning it lands here and joins the team in one tap.
 */
export function JoinSalonPageClient({ salon, joinCode = "" }) {
  const router = useRouter();
  const [status, setStatus] = useState("checking");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAuthMe()
      .then(({ ok, data }) => {
        if (cancelled) return;
        const user = ok ? data?.user : null;
        if (!user) {
          setStatus("guest");
          return;
        }
        if (user.type !== "artist") {
          setStatus("wrong-role");
          return;
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleJoin() {
    setStatus("joining");
    setErrorText("");
    try {
      const response = await fetch("/api/artist/join-salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonUserId: salon.id, code: joinCode })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok || payload?.code === "ALREADY_STAFF") {
        setStatus("joined");
        return;
      }
      setErrorText(payload?.error || "نشد؛ دوباره بزن.");
      setStatus("ready");
    } catch {
      setErrorText("نشد؛ دوباره بزن.");
      setStatus("ready");
    }
  }

  function handleGuestContinue() {
    try {
      window.localStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ id: salon.id, code: joinCode }));
    } catch {
      // ignore — the join simply won't auto-fire after login
    }
    enterApp(router, `/?join=${salon.id}&k=${encodeURIComponent(joinCode)}`);
  }

  return (
    <div className="joinSalonPage">
      <div className="joinSalonCard">
        <div className={`joinSalonAvatar ${salon.avatar ? "hasImage" : ""}`}>
          {salon.avatar ? <img src={salon.avatar} alt="" /> : <Sparkles size={26} />}
        </div>
        <span className="joinSalonKicker">دعوت به تیم</span>
        <h1>{salon.name}</h1>
        {salon.area ? <p className="joinSalonArea">{salon.area}</p> : null}

        {status === "checking" ? (
          <p className="joinSalonHint">یه لحظه…</p>
        ) : status === "guest" ? (
          <>
            <p className="joinSalonHint">
              با حساب آرتیستت وارد شو (یا یکی بساز) تا بری توی تیم «{salon.name}».
            </p>
            <button type="button" className="joinSalonAction" onClick={handleGuestContinue}>
              ورود یا ساخت حساب
            </button>
          </>
        ) : status === "wrong-role" ? (
          <>
            <p className="joinSalonHint is-warning">
              این لینک مال آرتیست‌هاست؛ با حساب آرتیستت وارد شو.
            </p>
            <button type="button" className="joinSalonAction is-secondary" onClick={() => router.push("/")}>
              برو به فرفرو
            </button>
          </>
        ) : status === "joined" ? (
          <div className="joinSalonSuccess">
            <CheckCircle2 size={28} aria-hidden="true" />
            <b>اومدی توی تیم «{salon.name}»!</b>
            <button type="button" className="joinSalonAction" onClick={() => enterApp(router)}>
              برو به خونه
            </button>
          </div>
        ) : (
          <>
            <ul className="joinSalonPerks">
              <li>نوبت‌هایی که سالن برات می‌ذاره توی برنامه‌ت هم میاد</li>
              <li>سالن همون لحظه خبردار می‌شه</li>
              <li>هر وقت خواستی از «همکاری» می‌تونی از تیم بری</li>
            </ul>
            <SalonRulesNote rules={salon.rules} open />
            {errorText ? <p className="joinSalonHint is-warning">{errorText}</p> : null}
            <button type="button" className="joinSalonAction" disabled={status === "joining"} onClick={handleJoin}>
              {status === "joining" ? "یه لحظه…" : salon.rules ? "قوانین رو قبول دارم، بریم" : `برو توی تیم ${salon.name}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
