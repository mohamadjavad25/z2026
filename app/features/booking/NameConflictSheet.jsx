"use client";

import { useState } from "react";
import { ProfileSheet } from "../profile/ProfileSheet";

function joinNames(names) {
  const quoted = names.map((name) => `«${name}»`);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join("، ")} و ${quoted[quoted.length - 1]}` : quoted[0] || "";
}

/**
 * Asked right before a booking is saved, when the number already belongs to a customer under another name (owner's
 * decision 2026-10-31). `ask` comes from findNameConflict (app/features/salons/customers.js):
 * - { type: "ask" }: «هر دو باشن» (this booking under the new name, the old ones stay as they are), «همون اسم قبلی»
 *   (this booking under the old name) or «اسم رو عوض کن» (every booking of the number gets the new name: asked once more,
 *   because it changes the old ones);
 * - { type: "account" }: the number belongs to a frfro account, so its own name is used; the owner is only told.
 * `busy`: the rename is on its way. `error`: what to do when it failed.
 */
export function NameConflictSheet({ ask, busy = false, error = "", onBoth, onKeepOld, onRename, onUseAccount, onClose }) {
  const [confirming, setConfirming] = useState(false);
  if (!ask) return null;

  if (ask.type === "account") {
    return (
      <ProfileSheet open kicker="اسم مشتری" title="این شماره حساب فرفرو داره" panelClassName="cuSheet" onClose={onClose}>
        <div className="cuSheetBody nameAsk">
          <p>حسابش با اسم {joinNames([ask.accountName])} ثبت شده. نوبت با همین اسم ثبت می‌شه.</p>
          <div className="nameAskChoices">
            <button type="button" className="vbSubmit" onClick={onUseAccount}>باشه، ثبت کن</button>
            <button type="button" className="nameAskChoice" onClick={onClose}>برگرد</button>
          </div>
        </div>
      </ProfileSheet>
    );
  }

  const known = ask.names.length > 1 ? `با اسم‌های ${joinNames(ask.names)}` : `با اسم ${joinNames(ask.names)}`;
  if (confirming) {
    return (
      <ProfileSheet open kicker="اسم مشتری" title="اسم عوض بشه؟" panelClassName="cuSheet" onClose={busy ? undefined : () => setConfirming(false)}>
        <div className="cuSheetBody nameAsk">
          <p>نوبت‌های قبلی این شماره هم با اسم «{ask.typed}» دیده می‌شن. مطمئنی؟</p>
          {error ? <p className="nameAskError" role="alert">{error}</p> : null}
          <div className="nameAskChoices">
            <button type="button" className="vbSubmit" onClick={onRename} disabled={busy}>{busy ? "صبر کن…" : "آره، عوض کن"}</button>
            <button type="button" className="nameAskChoice" onClick={() => setConfirming(false)} disabled={busy}>نه، برگرد</button>
          </div>
        </div>
      </ProfileSheet>
    );
  }
  return (
    <ProfileSheet open kicker="اسم مشتری" title={`این شماره ${known} ثبت شده`} panelClassName="cuSheet" onClose={onClose}>
      <div className="cuSheetBody nameAsk">
        <p>الان اسم «{ask.typed}» رو نوشتی. چی کار کنیم؟</p>
        <div className="nameAskChoices">
          <button type="button" className="vbSubmit" onClick={onBoth}>
            هر دو باشن
            <small>نوبت با اسم «{ask.typed}» ثبت می‌شه و نوبت‌های قبلی با اسم خودشون می‌مونن.</small>
          </button>
          <button type="button" className="nameAskChoice" onClick={onKeepOld}>
            همون «{ask.mainName}» بمونه
            <small>نوبت با اسم «{ask.mainName}» ثبت می‌شه.</small>
          </button>
          <button type="button" className="nameAskChoice" onClick={() => setConfirming(true)}>
            اسم رو عوض کن به «{ask.typed}»
            <small>همه‌ی نوبت‌های این شماره، قبلی‌ها هم، با اسم «{ask.typed}» دیده می‌شن.</small>
          </button>
          <button type="button" className="vbLink" onClick={onClose}>برگرد</button>
        </div>
      </div>
    </ProfileSheet>
  );
}
