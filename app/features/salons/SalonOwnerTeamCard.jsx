"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, PencilLine, Settings, Store, UserRoundPlus } from "lucide-react";
import { salonArtistRoleOptions } from "../../shared/constants/roles";
import { getSalonOwnerProfile } from "../../shared/api/salons";
import { compressImageToDataUrl } from "../../shared/lib/imageCompression";
import { ServiceIcon } from "../../components/ServiceIcon";

const DEFAULT_AVATAR = "/profile-icon.svg";

function splitRoles(role) {
  return String(role || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
}

/**
 * "I work here too": the manager's own card at the top of the staff tab, with its on/off switch.
 * The first time on asks for a team name, the fields they work in and a photo (the salon's picture or one of
 * their own). That profile is kept on the server, so switching off and on again is one tap, and while on the
 * card itself is their team card (they are not repeated in the list below). Tapping it opens the usual
 * staff sheet (state, stats); «ویرایش» reopens the form.
 */
export function SalonOwnerTeamCard({ managerName = "", ownerMember = null, onJoin, onLeave, onManage }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOn = Boolean(ownerMember);

  useEffect(() => {
    let alive = true;
    getSalonOwnerProfile()
      .then((result) => { if (alive && result.ok) setProfile(result.data?.profile || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // While on, the team row is the truth; while off, what they entered last time.
  const name = ownerMember?.name || profile?.name || "";
  const roles = splitRoles(ownerMember ? ownerMember.role : profile?.role);
  const avatar = ownerMember?.avatar
    || (profile?.useOwnPhoto ? profile.ownPhoto : profile?.salonPhoto)
    || "";
  const remembered = Boolean(ownerMember || profile?.saved);
  const isActive = ownerMember ? ownerMember.state !== "مرخصی" : false;

  const join = async (body, notice) => {
    setBusy(true);
    const saved = await onJoin?.(body, notice);
    setBusy(false);
    if (saved && "saved" in saved) setProfile(saved);
    return Boolean(saved);
  };

  const toggle = async () => {
    if (busy) return;
    if (isOn) {
      setBusy(true);
      await onLeave?.(ownerMember.name);
      setBusy(false);
      setEditing(false);
      return;
    }
    if (profile?.saved) {
      await join({}, "برگشتی توی تیم؛ با همون اسم، کارها و عکس قبلی.");
      return;
    }
    setEditing((current) => !current);
  };

  const showForm = editing;

  return (
    <section
      className={`stfSelf${isOn ? " is-on" : ""}${showForm ? " is-open" : ""}${remembered ? " has-profile" : ""}`}
      aria-label="خودم هم کار می‌کنم"
    >
      <div className="stfSelfHead">
        {remembered ? (
          <button
            type="button"
            className="stfSelfMe"
            disabled={!isOn}
            onClick={() => onManage?.(ownerMember)}
            aria-label={isOn ? `مدیریت کارت ${name}` : undefined}
          >
            <span className="stfAvatarWrap">
              <img className="stfSelfAvatar" src={avatar || DEFAULT_AVATAR} alt="" aria-hidden="true" draggable={false} />
              {isOn ? <i className={`stfDot ${isActive ? "is-active" : "is-idle"}`} aria-hidden="true" /> : null}
            </span>
            <span className="stfSelfCopy">
              <b>{name}<em className="stfOwnerBadge">خودم</em></b>
              {roles.length ? (
                <span className="stfSelfRoleLine">
                  <ServiceIcon name={roles[0]} size="xs" />
                  {roles.join("، ")}
                </span>
              ) : null}
              <small>
                {isOn
                  ? (isActive ? "توی تیمی و نوبت می‌گیری" : "توی تیمی؛ مرخصی هستی")
                  : "خاموشه؛ روشنش کنی با همین اطلاعات برمی‌گردی توی تیم"}
              </small>
            </span>
          </button>
        ) : (
          <>
            <span className="stfSelfIcon" aria-hidden="true"><UserRoundPlus size={28} /></span>
            <span className="stfSelfCopy">
              <b>خودم هم کار می‌کنم</b>
              <small>خودت رو هم بذار توی تیم تا نوبت به اسم خودت هم ثبت بشه</small>
            </span>
          </>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label="خودم هم کار می‌کنم"
          className="stfSwitch"
          disabled={busy}
          onClick={toggle}
        >
          <i aria-hidden="true">{isOn ? <Check size={13} strokeWidth={3} /> : null}</i>
        </button>
      </div>

      {remembered && !showForm ? (
        <div className="stfSelfTools">
          <button type="button" onClick={() => setEditing(true)}>
            <PencilLine size={15} />
            اسم، کارها و عکس
          </button>
          {isOn ? (
            <button type="button" onClick={() => onManage?.(ownerMember)}>
              <Settings size={15} />
              وضعیت و آمار
            </button>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <OwnerProfileForm
          key={isOn ? "on" : "off"}
          initialName={name || managerName}
          initialRoles={roles}
          profile={profile}
          joining={!isOn}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            const ok = await join(body, isOn ? "کارتت توی تیم ذخیره شد." : undefined);
            if (ok) setEditing(false);
          }}
        />
      ) : null}
    </section>
  );
}

function OwnerProfileForm({ initialName, initialRoles, profile, joining, busy, onCancel, onSubmit }) {
  const [name, setName] = useState(initialName);
  const [roles, setRoles] = useState(initialRoles);
  const [photoChoice, setPhotoChoice] = useState(profile?.useOwnPhoto ? "own" : "salon");
  const [newPhoto, setNewPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef(null);

  const salonPhoto = profile?.salonPhoto || "";
  const ownPhoto = newPhoto || profile?.ownPhoto || "";
  const preview = (photoChoice === "own" ? ownPhoto : salonPhoto) || DEFAULT_AVATAR;
  const missing = !name.trim() ? "اسمت رو بنویس" : !roles.length ? "دست‌کم یه کار انتخاب کن" : "";

  const toggleRole = (role) => setRoles((current) => (
    current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
  ));

  const pickOwn = () => {
    if (ownPhoto) setPhotoChoice("own");
    else fileRef.current?.click();
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("این فایل عکس نیست.");
      return;
    }
    setPhotoError("");
    setNewPhoto(await compressImageToDataUrl(file, { maxDimension: 640 }));
    setPhotoChoice("own");
  };

  return (
    <form
      className="stfSelfForm"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || missing) return;
        onSubmit({
          name: name.trim(),
          role: roles.join("، "),
          photo: photoChoice === "own" ? (newPhoto || "own") : "salon"
        });
      }}
    >
      <div className="stfSelfPreview" aria-label="پیش‌نمایش کارتت در تیم">
        <img src={preview} alt="" aria-hidden="true" draggable={false} />
        <span>
          <b>{name.trim() || "اسمت"}</b>
          <small>{roles.length ? roles.join("، ") : "کارهات اینجا دیده می‌شه"}</small>
        </span>
      </div>

      <label className="stfSelfField">
        <span>اسمت توی تیم</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً مریم" maxLength={80} />
        <small>مشتری‌ها موقع نوبت گرفتن همین اسم رو می‌بینن.</small>
      </label>

      <fieldset className="stfSelfField">
        <legend>چه کارهایی می‌کنی؟</legend>
        <div className="stfSelfRoles">
          {salonArtistRoleOptions.map((role) => (
            <button
              type="button"
              key={role}
              className={roles.includes(role) ? "is-on" : ""}
              aria-pressed={roles.includes(role)}
              onClick={() => toggleRole(role)}
            >
              <ServiceIcon name={role} size="xs" />
              {role}
              {roles.includes(role) ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="stfSelfField">
        <legend>عکس کارتت</legend>
        <div className="stfSelfPhotos">
          <button
            type="button"
            className={photoChoice === "salon" ? "is-on" : ""}
            aria-pressed={photoChoice === "salon"}
            onClick={() => setPhotoChoice("salon")}
          >
            {salonPhoto ? <img src={salonPhoto} alt="" aria-hidden="true" /> : <span className="stfSelfPhotoIcon"><Store size={22} /></span>}
            <span>عکس سالن</span>
            {photoChoice === "salon" ? <i aria-hidden="true"><Check size={12} strokeWidth={3} /></i> : null}
          </button>
          <button
            type="button"
            className={photoChoice === "own" ? "is-on" : ""}
            aria-pressed={photoChoice === "own"}
            onClick={pickOwn}
          >
            {ownPhoto ? <img src={ownPhoto} alt="" aria-hidden="true" /> : <span className="stfSelfPhotoIcon"><ImagePlus size={22} /></span>}
            <span>{ownPhoto ? "عکس خودم" : "یه عکس از خودم"}</span>
            {photoChoice === "own" ? <i aria-hidden="true"><Check size={12} strokeWidth={3} /></i> : null}
          </button>
        </div>
        {ownPhoto ? (
          <button type="button" className="stfSelfLink" onClick={() => fileRef.current?.click()}>
            <Camera size={14} />
            عوض کردن عکس خودم
          </button>
        ) : null}
        {photoError ? <small className="stfSelfError" role="alert">{photoError}</small> : null}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </fieldset>

      {missing ? <small className="stfSelfHint">{missing}</small> : null}
      <div className="stfSelfActions">
        <button type="submit" className="stfSelfSave" disabled={busy || Boolean(missing)}>
          {busy ? "یه لحظه…" : joining ? "خودمم بذار توی تیم" : "ذخیره"}
        </button>
        <button type="button" className="stfSelfCancel" onClick={onCancel}>انصراف</button>
      </div>
    </form>
  );
}
