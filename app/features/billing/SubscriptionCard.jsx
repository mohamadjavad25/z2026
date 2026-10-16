"use client";

import { useEffect } from "react";
import { ChevronLeft, FlaskConical, LoaderCircle, ReceiptText, UsersRound } from "lucide-react";
import { Button } from "../../components/ui";
import { toPersianDigits } from "../../shared/lib/digits";
import { accountView, teamMemberView } from "./billingView";
import { openPaymentHistory, openPaymentResult, openPlans, refreshBilling, useBilling } from "./billingStore";

/**
 * «اشتراک» at the top of Settings, for salons and artists. Where the account stands in one sentence, how much is
 * left, and the one button. Hidden entirely until billing is switched on (or the account has paid before).
 */
export function SubscriptionCard() {
  const { overview } = useBilling();
  useEffect(() => {
    refreshBilling();
  }, []);
  const view = accountView(overview);
  if (!view) return null;
  const meterPct = view.meter === null ? null : Math.round(view.meter * 100);

  return (
    <section className="spSection" aria-labelledby="spSection-billing">
      <h3 className="spSectionTitle" id="spSection-billing">اشتراک</h3>
      <div className={`billCard is-${view.tone}`}>
        <div className="billCardHead">
          <span className="billBadge">{view.badge}</span>
          {overview.sandbox ? <span className="billBadge is-test"><FlaskConical size={13} aria-hidden="true" /> آزمایشی</span> : null}
        </div>
        <b className="billCardTitle">{view.title}</b>
        <p className="billCardSub">{view.sub}</p>
        {meterPct !== null ? (
          <div className="billMeter" role="progressbar" aria-label="روزهای باقی‌مانده" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meterPct} aria-valuetext={`${toPersianDigits(meterPct)} درصد مانده`}>
            <i style={{ width: `${Math.max(meterPct, 3)}%` }} />
          </div>
        ) : null}
        {view.note ? <p className="billCardNote">{view.note}</p> : null}
        {overview.pending ? (
          <button type="button" className="billPendingRow" onClick={() => openPaymentResult(overview.pending.id)}>
            <LoaderCircle size={16} aria-hidden="true" className="billSpin" />
            <span>یک پرداخت در حال بررسی است</span>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        ) : null}
        <div className="billCardActions">
          <Button variant={view.action.emphasis} disabled={view.action.disabled} onClick={openPlans}>{view.action.label}</Button>
          <button type="button" className="billGhostBtn" onClick={openPaymentHistory}>
            <ReceiptText size={16} aria-hidden="true" /> پرداخت‌های من
          </button>
        </div>
      </div>
      {overview.role === "salon" && overview.team?.length ? <TeamSubscriptions overview={overview} /> : null}
    </section>
  );
}

/**
 * For salons: the artists on the team with an account of their own. Paying for them is optional; an artist the salon
 * does not pay for buys their own subscription, like any artist.
 */
function TeamSubscriptions({ overview }) {
  const ready = Boolean(overview.checkoutReady);
  return (
    <div className="billTeam">
      <div className="billTeamHead">
        <UsersRound size={18} aria-hidden="true" />
        <div>
          <b>اشتراک آرتیست‌های تیم</b>
          <p>اختیاری است: اگر بخواهی اشتراک آرتیستی را تو پرداخت می‌کنی؛ وگرنه هر آرتیست خودش پرداخت می‌کند.</p>
        </div>
      </div>
      <ul className="billTeamList">
        {overview.team.map((member) => {
          const view = teamMemberView(member, overview);
          return (
            <li key={member.id} className={`is-${view.tone}`}>
              <span className="billTeamAvatar" aria-hidden="true">
                {member.avatarUrl ? <img src={member.avatarUrl} alt="" loading="lazy" /> : (member.name || "؟").trim().charAt(0)}
              </span>
              <span className="billTeamMain">
                <b>{member.name}</b>
                <small><i aria-hidden="true" />{view.status}</small>
              </span>
              <Button size="sm" variant={view.urgent ? "primary" : "secondary"} disabled={!ready} onClick={() => openPlans(member.id)} aria-label={`پرداخت اشتراک ${member.name}`}>
                پرداخت
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
