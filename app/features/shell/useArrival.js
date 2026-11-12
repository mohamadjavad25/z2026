import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/api/client";
import { connectTo } from "../../shared/api/connections";
import { cleanPendingServices, parseOpenParam, peekPendingOpen, peekPendingRequest, rememberPendingOpen, rememberPendingRequest, takePendingOpen, takePendingRequest } from "../../shared/lib/appHandoff";
import { claimContactRequests } from "../../shared/api/contactRequests";

/**
 * What someone arrived for before they had a session: a salon's join link (`?join=`) or a public page's «رزرو»
 * (`?open=`). Kept through sign-up, then carried out once the session exists (tryJoinPendingSalon for an artist,
 * tryOpenPendingPlace for a client). Part of useHomeApp; call it before useAuthSession.
 */
export function useArrival({ setAppToast, setActiveTab, authCascadeRef, continueServiceRef }) {
  // Capture ?join={salonId} from a /join-salon/[id] QR/link redirect (guest
  // branch — see JoinSalonPageClient) before the auth gate renders, so the
  // pending join survives the login/signup round trip. Runs once, first
  // hook in the tree, so it always wins the race against useAuthSession's
  // own mount effect below. useAuthSession's onAuthenticated callback reads
  // this same key once a session exists (login/register/already-booted).
  // `?open=salon-12` (a public salon/artist page's «رزرو», shared/lib/appHandoff.js) is kept the same
  // way, so the visitor lands on that place after signing up instead of an empty home.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const joinSalonId = params.get("join");
    const openTarget = parseOpenParam(params.get("open"));
    // `?request=<code>`: a salon or artist from the SMS link of a client's request (app/r/[code]).
    const requestCode = params.get("request");
    if (requestCode) rememberPendingRequest(requestCode);
    if (!joinSalonId && !openTarget && !requestCode) return;
    if (joinSalonId) {
      try {
        window.localStorage.setItem("frfro_pending_join_salon", JSON.stringify({ id: joinSalonId, code: params.get("k") || "", termsVersion: params.get("v") ?? null }));
      } catch {
        // ignore — join just won't auto-fire post-login
      }
    }
    if (openTarget) {
      // The public page may have stored the name already; a bare link (a desktop QR) has only the id.
      const stored = peekPendingOpen();
      // Keep what the guest had ticked on the public page (name and services) when the same place is opened by id.
      // `&s=…`: a «وقتش شده» push names the service, so the booking form opens on it (owner's decision of 2026-10-25).
      const named = cleanPendingServices(params.getAll("s"));
      const same = stored?.id === openTarget.id;
      rememberPendingOpen({ ...openTarget, name: same ? stored.name : "", services: named.length ? named : same ? stored.services : [], staffId: same && !named.length ? stored.staffId : 0 });
    }
    // Keep the router's own history state: replacing it with {} made Next treat the page as a new one on its next
    // history change, so closing the services menu that opened here remounted the app back on the home screen.
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);
  // What a guest came for, so the sign-up screen can say it and skip the role picker
  // (null, or { kind: "open", name, type, id } / { kind: "join" }); read once on mount, after the effect above.
  const [arrivalIntent, setArrivalIntent] = useState(null);
  useEffect(() => {
    const target = peekPendingOpen();
    if (target) {
      setArrivalIntent({ kind: "open", name: target.name, type: target.type, id: target.id });
      return;
    }
    try {
      if (window.localStorage.getItem("frfro_pending_join_salon")) setArrivalIntent({ kind: "join" });
      else if (peekPendingRequest()) setArrivalIntent({ kind: "request" });
    } catch {
      // no pending join
    }
  }, []);

  // A salon or artist who came from a request's SMS link: the requests waiting for that number come into this
  // account (also when it was made with another number), and the requests list opens.
  async function tryClaimPendingRequest(profile) {
    if (profile?.type !== "salon" && profile?.type !== "artist") return false;
    const code = takePendingRequest();
    if (!code) return false;
    setArrivalIntent(null);
    try {
      const { ok, payload } = await claimContactRequests(code);
      if (!ok) {
        setAppToast(payload?.error || "نشد درخواست‌ها رو بیاریم؛ دوباره لینک رو باز کن.");
        return false;
      }
      if (payload?.data?.count) setAppToast("درخواست نوبت رسید؛ جوابش رو بده.");
    } catch {
      setAppToast("نشد درخواست‌ها رو بیاریم؛ دوباره لینک رو باز کن.");
      return false;
    }
    return true;
  }

  // Fires from useAuthSession's onAuthenticated below (boot/login/register —
  // covers an artist who was already logged in when they opened the
  // /join-salon/[id] link too, not just the guest→signup round trip).
  async function tryJoinPendingSalon(profile) {
    if (profile?.type !== "artist" || typeof window === "undefined") return;
    let pendingRaw = "";
    try {
      pendingRaw = window.localStorage.getItem("frfro_pending_join_salon") || "";
    } catch {
      return;
    }
    if (!pendingRaw) return;
    try {
      window.localStorage.removeItem("frfro_pending_join_salon");
    } catch {
      // ignore
    }
    // Older links (before the join code existed) stored a bare salon id string;
    // such a pending join has no code to offer and is simply dropped.
    let pendingSalonId = 0;
    let pendingCode = "";
    let pendingVersion = null;
    try {
      const parsed = JSON.parse(pendingRaw);
      pendingSalonId = Number(parsed?.id) || 0;
      pendingCode = String(parsed?.code || "");
      // The version of the terms she read on the join page; the server refuses (409) if they changed since.
      pendingVersion = parsed?.termsVersion == null || parsed.termsVersion === "" ? null : Number(parsed.termsVersion);
    } catch {
      return;
    }
    if (!pendingSalonId) return;
    try {
      const { ok, payload } = await apiFetch("/api/artist/join-salon", {
        method: "POST",
        body: JSON.stringify({ salonUserId: pendingSalonId, code: pendingCode, termsVersion: Number.isFinite(pendingVersion) ? pendingVersion : undefined })
      });
      if (ok) {
        setAppToast(`رفتی توی تیم «${payload?.data?.salon?.name || "سالن"}»!`);
      } else if (payload?.code === "TERMS_CHANGED") {
        setAppToast("شرایط سالن عوض شده. لینک رو دوباره باز کن و بخونش.");
      } else if (payload?.code !== "ALREADY_STAFF") {
        setAppToast(payload?.error || "نشد بری توی تیم سالن؛ دوباره بزن.");
      }
    } catch {
      setAppToast("نشد بری توی تیم سالن؛ دوباره بزن.");
    }
  }

  // A client who came from a public page's «رزرو»: connect them to that place (it lands in
  // «سالن و آرتیست من») and open its services menu. Salons and artists don't book, so it is dropped.
  async function tryOpenPendingPlace(profile) {
    if (typeof window === "undefined") return;
    const target = takePendingOpen();
    setArrivalIntent(null);
    if (!target || profile?.type !== "client") return;
    const c = authCascadeRef.current;
    let place = { id: target.id, type: target.type, name: target.name };
    try {
      const { ok, payload } = await connectTo(target.id);
      if (ok && payload?.data?.profile) {
        place = payload.data.profile;
        if (!payload.data.alreadyConnected) setAppToast(`«${place.name}» اضافه شد به سالن و آرتیست‌هات.`);
        c.refreshFollows?.();
      }
    } catch {
      // the page still opens; connecting can be done there
    }
    if (place.type !== "artist") setActiveTab("salons");
    // The guest had ticked a service on the public page: open the page plain and let it open the booking form on that service.
    if (target.services?.length && place.type !== "artist") {
      continueServiceRef.current?.begin(place.id, target.services, target.staffId);
      c.openConnectedProfile?.(place, null);
      return;
    }
    c.openConnectedProfile?.(place, { services: [], label: "همه خدمات" });
  }
  return { arrivalIntent, tryJoinPendingSalon, tryOpenPendingPlace, tryClaimPendingRequest };
}
