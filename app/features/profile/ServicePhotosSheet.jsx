"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import { Camera, Check } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { createPost } from "../../shared/api/posts";
import { PHOTO_TOO_BIG, MAX_PICKED_PHOTO_BYTES, UNREADABLE_PHOTO, compressImageToDataUrl, isPickedImage } from "../../shared/lib/imageCompression";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ProfileSheet } from "./ProfileSheet";

/** A service shows at most this many sample photos (same number as the server's MAX_SERVICE_PHOTOS). */
export const SERVICE_PHOTO_LIMIT = 3;

/**
 * Owner — picks the samples of one service and decides how they show: instead of the service icon (the default) or
 * with the icon staying and only a small button. A sample is one of the owner's own public works from «نمونه‌کار», or a
 * photo picked from the phone's gallery just for this service (kept as a post outside the portfolio, see
 * migration 074). The first one picked is the cover.
 *
 * Controlled by its caller: `onSubmit({ ids, asCover, previews })` gets the choice (a service card saves it through the
 * API, the service form keeps it in its draft until it is saved), `submitLabel` names the confirm button.
 */
export function ServicePhotosPicker({ name, emoji, initialIds = [], initialPhotos = [], initialAsCover = true, submitLabel = "", busy = false, error = "", onSubmit, onClose }) {
  const [posts, setPosts] = useState(null);
  const [picked, setPicked] = useState(initialIds);
  const [asCover, setAsCover] = useState(initialAsCover !== false);
  const [message, setMessage] = useState("");
  // Gallery photos of this service (posts outside the portfolio): the ones it already has and the ones added now.
  const [uploaded, setUploaded] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

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
        setMessage(`برای هر خدمت تا ${toPersianDigits(SERVICE_PHOTO_LIMIT)} نمونه می‌شه؛ یکی رو بردار.`);
        return current;
      }
      return [...current, id];
    });
  };

  const works = posts || [];
  const own = [...initialPhotos.map((photo) => ({ id: photo.postId, image: photo.image, title: photo.title || "" })), ...uploaded]
    .filter((item, index, list) => !works.some((work) => work.id === item.id) && list.findIndex((other) => other.id === item.id) === index);
  const items = [...own.map((item) => ({ ...item, fromGallery: true })), ...works];
  const cover = items.find((item) => item.id === picked[0]);
  const confirm = () => {
    const previews = picked.map((id) => items.find((item) => item.id === id)).filter(Boolean).map((item) => ({ postId: item.id, image: item.image, title: item.title || "" }));
    onSubmit?.({ ids: picked, asCover, previews });
  };

  const addFromGallery = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    if (!isPickedImage(file)) { setMessage(UNREADABLE_PHOTO); return; }
    if (file.size > MAX_PICKED_PHOTO_BYTES) { setMessage(PHOTO_TOO_BIG); return; }
    if (picked.length >= SERVICE_PHOTO_LIMIT) { setMessage(`برای هر خدمت تا ${toPersianDigits(SERVICE_PHOTO_LIMIT)} نمونه می‌شه؛ یکی رو بردار.`); return; }
    setUploading(true);
    try {
      const image = await compressImageToDataUrl(file);
      if (!image) { setMessage(UNREADABLE_PHOTO); return; }
      const { ok, payload } = await createPost({ title: name || "عکس خدمت", image, inPortfolio: false });
      const post = payload?.data?.post;
      if (!ok || !post) { setMessage(payload?.error || "عکس نرفت؛ دوباره بزن."); return; }
      setUploaded((list) => [...list, { id: post.id, image: post.image, title: post.title || "" }]);
      setPicked((current) => [...current, post.id]);
    } catch {
      setMessage("عکس نرفت؛ دوباره بزن.");
    } finally {
      setUploading(false);
    }
  };
  const label = submitLabel || "تموم";

  return (
    <ProfileSheet open kicker="نمونه" title={`نمونه‌های ${name || "خدمت"}`} label={`نمونه‌های ${name || "خدمت"}`} onClose={onClose}>
      <div className="svcPhotosSheet">
        {posts === null ? (
          <p className="svcPhotosHint" role="status">یه لحظه...</p>
        ) : (
          <>
            <p className="svcPhotosHint">{items.length ? `تا ${toPersianDigits(SERVICE_PHOTO_LIMIT)} نمونه؛ اولی اصلیه.` : "یه عکس از گالری بذار."}</p>
            <div className="svcPhotosGrid">
              <button type="button" className="svcPhotosTile is-add" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="عکس از گالری">
                <Camera size={22} />
                <span>{uploading ? "دارم می‌فرستم…" : "از گالری"}</span>
              </button>
              <input ref={fileRef} className="captureInput" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={addFromGallery} />
              {items.map((item) => {
                const index = picked.indexOf(item.id);
                const on = index >= 0;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`svcPhotosTile${on ? " is-picked" : ""}`}
                    aria-pressed={on}
                    aria-label={item.title || "نمونه"}
                    onClick={() => toggle(item.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${item.image}&w=360`} alt="" loading="lazy" />
                    {on ? <span className="svcPhotosNum">{index === 0 ? <Check size={13} strokeWidth={3} /> : toPersianDigits(index + 1)}</span> : null}
                    {on && index === 0 ? <em>اصلی</em> : null}
                  </button>
                );
              })}
            </div>
            {picked.length ? (
              <div className="svcPhotosSeg" role="radiogroup" aria-label="تو فهرست خدمات">
                <button type="button" role="radio" aria-checked={asCover} className={asCover ? "is-on" : ""} onClick={() => setAsCover(true)}>
                  {cover ? <img src={`${cover.image}&w=80`} alt="" /> : null}
                  جای آیکن
                </button>
                <button type="button" role="radio" aria-checked={!asCover} className={asCover ? "" : "is-on"} onClick={() => setAsCover(false)}>
                  <ServiceIcon emoji={emoji} name={name} size="xs" />
                  آیکن بمونه
                </button>
              </div>
            ) : null}
          </>
        )}
        {message || error ? <p className="svcPhotosMsg" role="alert">{message || error}</p> : null}
        <button type="button" className="svcPhotosSave" disabled={busy || uploading || posts === null} onClick={confirm}>
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
      if (!ok) { setError(payload?.error || "نمونه‌ها ذخیره نشد؛ دوباره بزن."); return; }
      await onSaved?.();
      onClose?.();
    } catch {
      setError("نمونه‌ها ذخیره نشد؛ دوباره بزن.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ServicePhotosPicker
      name={service.name}
      emoji={service.emoji}
      initialIds={(service.photos || []).map((photo) => photo.postId)}
      initialPhotos={service.photos || []}
      initialAsCover={service.photoAsCover !== false}
      busy={busy}
      error={error}
      onSubmit={save}
      onClose={onClose}
    />
  );
}

