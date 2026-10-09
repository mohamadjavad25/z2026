"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { getAuthMe } from "../../shared/api/auth";

const PENDING_JOIN_KEY = "frfru_pending_join_salon";

/**
 * QR/link landing page (app/join-salon/[id]) — standalone, auth-agnostic.
 * Salon shows this as a QR code (see SalonNearbyInviteSheet's artistInviteQrCard);
 * an artist scanning it lands here and joins the team in one tap.
 */
export function JoinSalonPageClient({ salon }) {
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
        body: JSON.stringify({ salonUserId: salon.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok || payload?.code === "ALREADY_STAFF") {
        setStatus("joined");
        return;
      }
      setErrorText(payload?.error || "پیوستن انجام نشد؛ دوباره امتحان کن.");
      setStatus("ready");
    } catch {
      setErrorText("پیوستن انجام نشد؛ دوباره امتحان کن.");
      setStatus("ready");
    }
  }

  function handleGuestContinue() {
    try {
      window.localStorage.setItem(PENDING_JOIN_KEY, String(salon.id));
    } catch {
      // ignore — the join simply won't auto-fire after login
    }
    router.push(`/?join=${salon.id}`);
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
          <p className="joinSalonHint">در حال بررسی حساب...</p>
        ) : status === "guest" ? (
          <>
            <p className="joinSalonHint">
              با ورود یا ساخت حساب آرتیست، به تیم «{salon.name}» می‌پیوندی.
            </p>
            <button type="button" className="joinSalonAction" onClick={handleGuestContinue}>
              ورود یا ثبت‌نام در Frfru
            </button>
          </>
        ) : status === "wrong-role" ? (
          <>
            <p className="joinSalonHint is-warning">
              این لینک فقط برای پیوستن آرتیست‌هاست. با یک حساب آرتیست وارد شو.
            </p>
            <button type="button" className="joinSalonAction is-secondary" onClick={() => router.push("/")}>
              رفتن به Frfru
            </button>
          </>
        ) : status === "joined" ? (
          <div className="joinSalonSuccess">
            <CheckCircle2 size={28} aria-hidden="true" />
            <b>به تیم «{salon.name}» پیوستی!</b>
            <button type="button" className="joinSalonAction" onClick={() => router.push("/")}>
              رفتن به داشبورد
            </button>
          </div>
        ) : (
          <>
            <ul className="joinSalonPerks">
              <li>نوبت‌های مشتری‌های سالن در برنامه‌ات هم نشان داده می‌شود</li>
              <li>سالن بلافاصله از پیوستن تو باخبر می‌شود</li>
              <li>هر زمان خواستی از بخش «همکاری» می‌توانی تیم را ترک کنی</li>
            </ul>
            {errorText ? <p className="joinSalonHint is-warning">{errorText}</p> : null}
            <button type="button" className="joinSalonAction" disabled={status === "joining"} onClick={handleJoin}>
              {status === "joining" ? "در حال پیوستن..." : `پیوستن به تیم ${salon.name}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
