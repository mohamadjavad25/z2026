"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ProfileSheet } from "./ProfileSheet";

/** A service shows at most this many sample photos (same number as the server's MAX_SERVICE_PHOTOS). */
export const SERVICE_PHOTO_LIMIT = 3;

/**
 * Owner — picks the sample photos of one service from their own public portfolio posts and decides how they show:
 * instead of the service icon (the default) or with the icon staying and only a small photo button. Nothing is
 * uploaded here: a photo is a post that is already in «نمونه‌کار». The first one picked is the cover.
 *
 * Controlled by its caller: `onSubmit({ ids, asCover, previews })` gets the choice (a service card saves it through the
 * API, the service form keeps it in its draft until it is saved), `submitLabel` names the confirm button.
 */
export function ServicePhotosPicker({ name, emoji, initialIds = [], initialAsCover = true, submitLabel = "", busy = false, error = "", onSubmit, onClose }) {
  const [posts, setPosts] = useState(null);
  const [picked, setPicked] = useState(initialIds);
  const [asCover, setAsCover] = useState(initialAsCover !== false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    apiFetch("/api/posts").then(({ ok, payload }) => {
      if (!alive) return;
      const list = ok && Array.isArray(payload?.data?.posts) ? payload.data.posts : [];
      setPosts(list.filter((post) => post.isPublic && post.image));
    }).catch(() => { if (alive) setPosts([]); });
    return () => { alive = false; };
  }, []);

  const toggle = (id) => {
    setMessage("");
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= SERVICE_PHOTO_LIMIT) {
        setMessage(`برای هر خدمت تا ${toPersianDigits(SERVICE_PHOTO_LIMIT)} عکس می‌شه؛ یکی رو بردار.`);
        return current;
      }
      return [...current, id];
    });
  };

  const empty = posts && posts.length === 0;
  const cover = posts?.find((post) => post.id === picked[0]);
  const confirm = () => {
    if (empty) { onClose?.(); return; }
    const previews = picked.map((id) => posts.find((post) => post.id === id)).filter(Boolean).map((post) => ({ postId: post.id, image: post.image, title: post.title || "" }));
    onSubmit?.({ ids: picked, asCover, previews });
  };
  const label = empty ? "باشه" : submitLabel || (picked.length ? `ذخیره، ${toPersianDigits(picked.length)} عکس` : "بدون عکس");

  return (
    <ProfileSheet open kicker="عکس نمونه" title={`عکس‌های ${name || "خدمت"}`} label={`عکس‌های ${name || "خدمت"}`} onClose={onClose}>
      <div className="svcPhotosSheet">
        {posts === null ? (
          <p className="svcPhotosHint" role="status">یه لحظه...</p>
        ) : empty ? (
          <div className="svcPhotosEmpty" role="status">
            <b>هنوز نمونه‌کاری نذاشتی</b>
            <span>اولین کارت رو توی «نمونه‌کار» بذار؛ همون‌جا می‌تونی بگی مال کدوم خدمته، یا بعداً از همین‌جا وصلش کنی.</span>
          </div>
        ) : (
          <>
            <p className="svcPhotosHint">از نمونه‌کارهات تا {toPersianDigits(SERVICE_PHOTO_LIMIT)} تا انتخاب کن. اولی عکس اصلیه. وصل نکنی هم خدمت مثل قبل می‌مونه.</p>
            <div className="svcPhotosGrid">
              {posts.map((post) => {
                const index = picked.indexOf(post.id);
                const on = index >= 0;
                return (
                  <button
                    type="button"
                    key={post.id}
                    className={`svcPhotosTile${on ? " is-picked" : ""}`}
                    aria-pressed={on}
                    aria-label={post.title || "نمونه‌کار"}
                    onClick={() => toggle(post.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${post.image}&w=360`} alt="" loading="lazy" />
                    {on ? <span className="svcPhotosNum">{index === 0 ? <Check size={13} strokeWidth={3} /> : toPersianDigits(index + 1)}</span> : null}
                    {on && index === 0 ? <em>عکس اصلی</em> : null}
                  </button>
                );
              })}
            </div>
            {picked.length ? (
              <fieldset className="svcPhotosMode">
                <legend>تو فهرست خدمات چطور دیده بشه؟</legend>
                <label className={asCover ? "is-on" : ""}>
                  <input type="radio" name="svcPhotoMode" checked={asCover} onChange={() => setAsCover(true)} />
                  <span className="svcPhotosModeRow">
                    {cover ? <span className="svcModeThumb"><img src={`${cover.image}&w=120`} alt="" /></span> : <span className="svcModeThumb" />}
                    <span><b>عکس به‌جای آیکن</b><small>عکس اصلی همون‌جا می‌نشینه</small></span>
                  </span>
                </label>
                <label className={asCover ? "" : "is-on"}>
                  <input type="radio" name="svcPhotoMode" checked={!asCover} onChange={() => setAsCover(false)} />
                  <span className="svcPhotosModeRow">
                    <span className="svcModeThumb is-icon"><ServiceIcon emoji={emoji} name={name} size="sm" /></span>
                    <span><b>آیکن بمونه</b><small>عکس‌ها با یه دکمهٔ کوچیک «{toPersianDigits(picked.length)} عکس» باز می‌شن</small></span>
                  </span>
                </label>
              </fieldset>
            ) : null}
          </>
        )}
        {message || error ? <p className="svcPhotosMsg" role="alert">{message || error}</p> : null}
        <button type="button" className="svcPhotosSave" disabled={busy || posts === null} onClick={confirm}>
          {busy ? "دارم ذخیره می‌کنم…" : label}
        </button>
      </div>
    </ProfileSheet>
  );
}

/** The picker for a service card: saves the choice straight to the service through the API. */
export function ServicePhotosEditor({ service, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!service) return null;
  const save = async ({ ids, asCover }) => {
    setBusy(true);
    setError("");
    try {
      const { ok, payload } = await apiFetch("/api/service-photos", {
        method: "PUT",
        body: JSON.stringify({ serviceId: service.id, postIds: ids, photoAsCover: asCover })
      });
      if (!ok) { setError(payload?.error || "عکس‌ها ذخیره نشد؛ دوباره بزن."); return; }
      await onSaved?.();
      onClose?.();
    } catch {
      setError("عکس‌ها ذخیره نشد؛ دوباره بزن.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ServicePhotosPicker
      name={service.name}
      emoji={service.emoji}
      initialIds={(service.photos || []).map((photo) => photo.postId)}
      initialAsCover={service.photoAsCover !== false}
      busy={busy}
      error={error}
      onSubmit={save}
      onClose={onClose}
    />
  );
}

