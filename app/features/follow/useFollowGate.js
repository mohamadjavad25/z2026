"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../shared/api/client";
import { getAuthMe } from "../../shared/api/auth";
import { createSalonInvite } from "../../shared/api/salons";

const TYPE_NAME = { salon: "سالن", artist: "آرتیست" };

/**
 * «وصل شو» on a public salon or artist page (the page a QR code or a shared link opens).
 *
 * A follow is a contact, so it needs an account (name + phone). The visitor either already has one, or
 * makes one right here in a sheet; afterwards the follow is done on the very same page and a thank-you
 * is shown. Nothing sends them to the app in between.
 *
 * A follow is for clients. A salon or artist who lands here (a salon owner scanned an artist's code, say) is
 * never made a follower: a salon asking for an artist sends a team invite, and anything else gets a plain
 * sentence on what to do instead (`outcome`).
 *
 * sheet: "closed" | "account" (sign up / log in) | "done" (thank-you) | "owner" (the `outcome` text)
 */
export function useFollowGate({ targetId, targetName, targetType = "salon" }) {
  const [viewer, setViewer] = useState(undefined); // undefined: still checking · null: not signed in
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState("closed");
  const [justCreated, setJustCreated] = useState(false);
  const [notice, setNotice] = useState("");
  const [outcome, setOutcome] = useState(null); // { title, text } for a salon or artist visitor
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getAuthMe();
        const user = me.ok ? me.data?.user || null : null;
        if (cancelled) return;
        setViewer(user);
        if (!user) return;
        const { ok, payload } = await apiFetch("/api/follows");
        if (cancelled || !ok) return;
        setFollowing((payload.data?.followingIds || []).map(Number).includes(Number(targetId)));
      } catch {
        if (!cancelled) setViewer(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /** Sets the follow on the server. Resolves to an error message, or "" when it worked. */
  const setFollow = useCallback(async (follow) => {
    try {
      const { ok, payload } = await apiFetch("/api/follows", {
        method: "POST",
        body: JSON.stringify({ targetUserId: Number(targetId), follow })
      });
      if (!ok) return payload?.error || "وصل نشد؛ دوباره بزن.";
      setFollowing(Boolean(payload.data?.following));
      return "";
    } catch {
      return "وصل نشد؛ دوباره بزن.";
    }
  }, [targetId]);

  /** A salon or artist visitor: invites the artist to the salon's team, or says why nothing happens. Resolves to "". */
  const handleOwner = useCallback(async (user) => {
    const show = (title, text) => {
      setOutcome({ title, text });
      setSheet("owner");
    };
    if (user.type === targetType) {
      show("وصل نمی‌شن", `این صفحه مال یه ${TYPE_NAME[targetType]}ـه؛ ${TYPE_NAME[user.type]}ها به هم وصل نمی‌شن.`);
    } else if (user.type === "artist") {
      show("کد تیم لازمه", `برای رفتن به تیم «${targetName}»، از سالن‌دار بخواه از «پرسنل ← دعوت آرتیست» کد تیم رو نشونت بده و از بخش «همکاری» اسکنش کن. یا «کد من» رو بزن و کدت رو نشونش بده تا دعوتت کنه.`);
    } else if (user.type === "salon") {
      try {
        const { ok, payload } = await createSalonInvite({ artistUserId: Number(targetId) });
        if (ok) {
          show(
            payload.data?.created === false ? "قبلاً دعوتش کرده بودی" : "دعوت رفت",
            payload.data?.created === false
              ? `منتظر جواب «${targetName}» هستی.`
              : `دعوت برای «${targetName}» رفت. تا قبول نکنه، توی تیمت نمیاد؛ جوابش رو توی اعلان‌هات می‌بینی.`
          );
        } else if (payload?.code === "PENDING_EXISTS") {
          show("قبلاً دعوتش کرده بودی", `منتظر جواب «${targetName}» هستی.`);
        } else if (payload?.code === "ALREADY_STAFF" || payload?.code === "ALREADY_ACCEPTED") {
          show("توی تیمته", `«${targetName}» از قبل توی تیم توئه.`);
        } else {
          show("دعوت نرفت", payload?.error || "دعوت نرفت؛ دوباره بزن.");
        }
      } catch {
        show("دعوت نرفت", "دعوت نرفت؛ دوباره بزن.");
      }
    } else {
      setSheet("closed");
    }
    return "";
  }, [targetId, targetName, targetType]);

  const onFollowClick = useCallback(async () => {
    if (viewer === undefined || busyRef.current) return;
    if (!viewer) {
      setSheet("account");
      return;
    }
    if (Number(viewer.id) === Number(targetId)) {
      setNotice("این صفحهٔ خودته.");
      return;
    }
    if (viewer.type !== "client") {
      busyRef.current = true;
      setBusy(true);
      try {
        await handleOwner(viewer);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (following) {
        const failure = await setFollow(false);
        setNotice(failure || `«${targetName}» دیگه وصل نیست.`);
        return;
      }
      const failure = await setFollow(true);
      if (failure) setNotice(failure);
      else {
        setJustCreated(false);
        setSheet("done");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [viewer, following, targetId, targetName, setFollow, handleOwner]);

  /** The visitor just made an account or logged in inside the sheet: follow now and say thanks. */
  const onAccountReady = useCallback(async (user, { created = false } = {}) => {
    setViewer(user);
    if (Number(user?.id) === Number(targetId)) {
      setSheet("closed");
      setNotice("این صفحهٔ خودته.");
      return "";
    }
    if (user?.type && user.type !== "client") return handleOwner(user);
    const failure = await setFollow(true);
    if (failure) {
      setSheet("closed");
      setNotice(created ? "حسابت ساخته شد، ولی وصل نشد؛ دوباره دکمه رو بزن." : failure);
      return "";
    }
    setJustCreated(created);
    setSheet("done");
    return "";
  }, [targetId, setFollow, handleOwner]);

  return {
    viewer,
    following,
    busy,
    sheet,
    justCreated,
    notice,
    outcome,
    targetName,
    targetId,
    targetType,
    onFollowClick,
    onAccountReady,
    closeSheet: () => setSheet("closed")
  };
}
