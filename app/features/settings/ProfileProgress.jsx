"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { profileTodos, progressOf } from "./profileProgress";

const RING = 2 * Math.PI * 26;

/** The «+» opens the very thing the todo is about, by finding its button on the page (no second copy of each editor). */
function openTarget(target, onEditProfile) {
  if (target === "edit") {
    onEditProfile?.();
    return;
  }
  const direct = { avatar: ".brandCardAvatarEdit", poster: ".brandCardPosterEdit" }[target];
  const el = document.querySelector(direct || `[data-todo-slot="${target}"] button`);
  el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  el?.click();
}

/**
 * «کارهای مونده» (owner's pick 2026-10-28): a ring with the percent and one tappable row per thing still undone.
 * When the last one is done it says «پروفایلت کامله» for a moment and goes away; a profile that is already complete
 * never shows it.
 */
export function ProfileProgress({ type, data, hasDefaultAvatar, openDaysCount, onEditProfile }) {
  const todos = profileTodos({ type, data, hasDefaultAvatar, openDaysCount });
  const { pct, left } = progressOf(todos);
  const hadWork = useRef(left.length > 0);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (left.length > 0) {
      hadWork.current = true;
      return undefined;
    }
    if (!hadWork.current) return undefined;
    hadWork.current = false;
    setCelebrate(true);
    const timer = window.setTimeout(() => setCelebrate(false), 2600);
    return () => window.clearTimeout(timer);
  }, [left.length]);

  if (celebrate) {
    return (
      <section className="spProg is-done" aria-live="polite">
        <i aria-hidden="true"><Check size={18} strokeWidth={3} /></i>
        <b>پروفایلت کامله</b>
      </section>
    );
  }
  if (!left.length) return null;

  return (
    <section className="spProg" aria-label="کارهای مونده">
      <div className="spProgTop">
        <div className="spProgRing" role="img" aria-label={`${toPersianDigits(pct)} درصد کامله`}>
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="26" className="spProgTrack" />
            <circle cx="32" cy="32" r="26" className="spProgFill" strokeDasharray={`${((RING * pct) / 100).toFixed(1)} ${RING.toFixed(1)}`} />
          </svg>
          <b>٪{toPersianDigits(pct)}</b>
        </div>
        <div className="spProgCopy">
          <b>پروفایلت هنوز کامل نیست</b>
          <small>{left.length === 1 ? "فقط یه کار مونده." : type === "client" ? "چند تا کار مونده." : "با اینا مشتری بیشتری پیدات می‌کنه."}</small>
        </div>
      </div>
      <div className="spProgList">
        {left.map((todo) => (
          <button key={todo.key} type="button" className="spProgTodo" onClick={() => openTarget(todo.target, onEditProfile)}>
            <span>{todo.label}</span>
            <i aria-hidden="true"><Plus size={15} strokeWidth={3} /></i>
          </button>
        ))}
      </div>
    </section>
  );
}
