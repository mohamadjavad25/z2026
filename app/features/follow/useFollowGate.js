"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../shared/api/client";
import { getAuthMe } from "../../shared/api/auth";

/**
 * «وصل شو» on a public salon or artist page (the page a QR code or a shared link opens).
 *
 * A follow is a contact, so it needs an account (name + phone). The visitor either already has one, or
 * makes one right here in a sheet; afterwards the follow is done on the very same page and a thank-you
 * is shown. Nothing sends them to the app in between.
 *
 * sheet: "closed" | "account" (sign up / log in) | "done" (thank-you)
 */
export function useFollowGate({ targetId, targetName, targetType = "salon" }) {
  const [viewer, setViewer] = useState(undefined); // undefined: still checking · null: not signed in
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState("closed");
  const [justCreated, setJustCreated] = useState(false);
  const [notice, setNotice] = useState("");
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
      if (!ok) return payload?.error || "وصل شدن انجام نشد؛ دوباره امتحان کن.";
      setFollowing(Boolean(payload.data?.following));
      return "";
    } catch {
      return "وصل شدن انجام نشد؛ دوباره امتحان کن.";
    }
  }, [targetId]);

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
    busyRef.current = true;
    setBusy(true);
    try {
      if (following) {
        const failure = await setFollow(false);
        setNotice(failure || `«${targetName}» از لیستت برداشته شد.`);
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
  }, [viewer, following, targetId, targetName, setFollow]);

  /** The visitor just made an account or logged in inside the sheet: follow now and say thanks. */
  const onAccountReady = useCallback(async (user, { created = false } = {}) => {
    setViewer(user);
    if (Number(user?.id) === Number(targetId)) {
      setSheet("closed");
      setNotice("این صفحهٔ خودته.");
      return "";
    }
    const failure = await setFollow(true);
    if (failure) {
      setSheet("closed");
      setNotice(created ? "حسابت ساخته شد، اما وصل شدن انجام نشد. دوباره دکمه را بزن." : failure);
      return "";
    }
    setJustCreated(created);
    setSheet("done");
    return "";
  }, [targetId, setFollow]);

  return {
    viewer,
    following,
    busy,
    sheet,
    justCreated,
    notice,
    targetName,
    targetId,
    targetType,
    onFollowClick,
    onAccountReady,
    closeSheet: () => setSheet("closed")
  };
}
