"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { optOutOfContactRequests } from "../../shared/api/contactRequests";
import { rememberPendingRequest } from "../../shared/lib/appHandoff";

// The app, not the about page: a client-side navigation does not re-run the root layout's head script.
function enterApp(router, href) {
  document.documentElement.classList.add("skip-landing");
  router.push(href);
}

/** The link page's screen: the requests, «جواب بده», and a quiet «دیگه پیام نده». */
export function RequestLinkClient({ code, requests, delivered }) {
  const router = useRouter();
  const [state, setState] = useState("idle"); // idle | stopping | stopped | error

  function answer() {
    rememberPendingRequest(code);
    enterApp(router, `/?request=${encodeURIComponent(code)}`);
  }

  async function stop() {
    setState("stopping");
    try {
      const { ok } = await optOutOfContactRequests(code);
      setState(ok ? "stopped" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "stopped") {
    return (
      <div className="joinSalonPage">
        <div className="joinSalonCard">
          <div className="joinSalonSuccess">
            <CheckCircle2 size={28} aria-hidden="true" />
            <b>باشه؛ دیگه پیامی نمی‌فرستیم.</b>
          </div>
        </div>
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="joinSalonPage">
        <div className="joinSalonCard">
          <span className="joinSalonKicker">فرفرو</span>
          <h1>{delivered ? "درخواست‌ها توی حسابته" : "این درخواست دیگه باز نیست"}</h1>
          <button type="button" className="joinSalonAction" onClick={() => enterApp(router, "/")}>برو به فرفرو</button>
        </div>
      </div>
    );
  }

  return (
    <div className="joinSalonPage">
      <div className="joinSalonCard">
        <span className="joinSalonKicker">فرفرو</span>
        <h1>{requests.length > 1 ? "ازت نوبت خواستن" : `${requests[0].client} ازت نوبت خواسته`}</h1>
        <ul className="reqLinkList">
          {requests.map((request) => (
            <li key={request.id} className="reqLinkItem">
              <ServiceIcon emoji={request.serviceEmoji} name={request.service} size="sm" />
              <span>
                <b>{request.service}</b>
                <small>{requests.length > 1 ? `${request.client} · ` : ""}{request.when}</small>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="joinSalonAction is-live" onClick={answer}>وارد شو و جواب بده</button>
        {state === "error" ? <p className="joinSalonHint is-warning" role="alert">نشد؛ دوباره بزن.</p> : null}
        <button type="button" className="reqLinkStop" onClick={stop} disabled={state === "stopping"}>دیگه پیام نده</button>
      </div>
    </div>
  );
}
