"use client";

import { MessageSquareText, FlaskConical } from "lucide-react";
import { Button } from "../../components/ui";
import { Mascot } from "../../components/Mascot";
import { toPersianDigits } from "../../shared/lib/digits";
import { smsView } from "./billingView";
import { openSmsPack, useBilling } from "./billingStore";

/**
 * «پیامک مشتری‌هات» under the subscription card in Settings (owner's design of 2026-10-28, the bubbles): how many SMS
 * the account can still send to its clients this month, as filled bubbles (one bubble is ten SMS), and the button for a
 * pack. Salons and artists only; hidden until billing is on, like the subscription card above it.
 */
export function SmsPackCard() {
  const { overview } = useBilling();
  const view = smsView(overview);
  if (!view) return null;
  const left = toPersianDigits(view.left);

  return (
    <section className="spSection spSms" aria-label="پیامک مشتری‌ها">
      <div className={`smsCard is-${view.state}`}>
        <div className="smsHead">
          <span className="billBadge is-brand"><MessageSquareText size={13} aria-hidden="true" /> پیامک مشتری‌هات</span>
          {overview.sandbox ? <span className="billBadge is-test"><FlaskConical size={13} aria-hidden="true" /> آزمایشی</span> : null}
        </div>
        <div className="smsMain">
          <div className="smsBig" aria-hidden="true">
            <b>{left}</b>
            <span>پیامک مونده</span>
          </div>
          <Mascot pose={view.pose} size={92} className="smsMascot" />
        </div>
        <div className="smsBubbles" role="img" aria-label={`${left} پیامک مونده`}>
          {Array.from({ length: view.bubbleCount }, (_, index) => (
            <span key={index} className={index < view.filled ? "is-on" : ""} />
          ))}
        </div>
        <p className="smsSub">{view.sub}</p>
        <Button block variant={view.action.emphasis} disabled={view.action.disabled} onClick={openSmsPack}>
          {view.action.label}
        </Button>
      </div>
    </section>
  );
}
