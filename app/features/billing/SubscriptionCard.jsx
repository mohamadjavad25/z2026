"use client";

import { Spinner } from "../../components/Spinner";
import { useEffect } from "react";
import { ChevronLeft, FlaskConical, Lock, ReceiptText, Star, UsersRound } from "lucide-react";
import { Button } from "../../components/ui";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber } from "../../shared/lib/money";
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
  if (overview?.testAccount) return <TestAccountCard />;
  if (overview?.preview) return <PaymentsOffCard overview={overview} />;
  const view = accountView(overview);
  if (!view) return null;
  const meterPct = view.meter === null ? null : Math.round(view.meter * 100);
  // The big number is the days left, only while there are some. A week or less (view.low) turns the card warmer; closed or in
  // grace, it turns dark (owner's decision 2026-10-28, the card is the flashy one on the page).
  const daysLeft = view.tone === "trial" || view.tone === "active" ? Math.max(0, Number(overview.account?.daysLeft) || 0) : null;
  const closed = view.tone === "warn" || view.tone === "danger";
  const low = Boolean(view.low);

  return (
    <section className="spSection spPay" aria-label="اشتراک">
      <div className={`billCard is-${view.tone}${low ? " is-low" : ""}${closed ? " is-closed" : ""}`}>
        <svg className="billSwirl" viewBox="0 0 120 120" aria-hidden="true">
          <path d="M60 60c0-8 8-10 12-5s0 14-9 14-17-9-14-21 20-18 33-10 18 28 8 41-34 15-46 2" />
        </svg>
        <div className="billCardHead">
          <span className="billBadge is-brand">
            {closed ? <Lock size={13} aria-hidden="true" /> : <Star size={13} aria-hidden="true" />} اشتراک فرفرو
          </span>
          <span className="billBadge is-state">{view.badge}</span>
          {overview.sandbox ? <span className="billBadge is-test"><FlaskConical size={13} aria-hidden="true" /> آزمایشی</span> : null}
        </div>
        {daysLeft !== null ? (
          <div className="billBig" aria-hidden="true">
            <span className="billBigNum">{toPersianDigits(daysLeft)}</span>
            <span className="billBigUnit"><b>روز</b><small>مونده</small></span>
          </div>
        ) : null}
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
            <Spinner size={16} />
            <span>یه پرداخت داره چک می‌شه</span>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        ) : null}
        <div className="billCardActions">
          <button type="button" className="billPayBtn" disabled={view.action.disabled} onClick={openPlans}>
            {view.action.label}
          </button>
          <button type="button" className="billGhostBtn" onClick={openPaymentHistory}>
            <ReceiptText size={16} aria-hidden="true" /> پرداخت‌هام
          </button>
        </div>
      </div>
      {overview.role === "salon" && overview.team?.length ? <TeamSubscriptions overview={overview} /> : null}
    </section>
  );
}

/** The owner's own test number: always free, never listed. Nothing to buy and nothing to count. */
function TestAccountCard() {
  return (
    <section className="spSection spPay" aria-label="اشتراک">
      <div className="billCard is-trial is-off">
        <svg className="billSwirl" viewBox="0 0 120 120" aria-hidden="true">
          <path d="M60 60c0-8 8-10 12-5s0 14-9 14-17-9-14-21 20-18 33-10 18 28 8 41-34 15-46 2" />
        </svg>
        <div className="billCardHead">
          <span className="billBadge is-brand"><FlaskConical size={13} aria-hidden="true" /> حساب آزمایشی</span>
        </div>
        <b className="billCardTitle">این حساب همیشه رایگانه</b>
        <p className="billCardSub">اشتراک نمی‌خواد و بسته نمی‌شه. توی جست‌وجو و فهرست سالن‌ها و آرتیست‌ها هم دیده نمی‌شه؛ فقط با لینک صفحه‌ش می‌شه رفت سراغش.</p>
      </div>
    </section>
  );
}

/**
 * Payment is switched off (and the account never paid): nothing to buy or count yet, but the owner sees what it will
 * cost and how the free month works (owner's request 2026-10-28). The free days start the day payment is switched on.
 */
function PaymentsOffCard({ overview }) {
  return (
    <section className="spSection spPay" aria-label="اشتراک">
      <div className="billCard is-trial is-off">
        <svg className="billSwirl" viewBox="0 0 120 120" aria-hidden="true">
          <path d="M60 60c0-8 8-10 12-5s0 14-9 14-17-9-14-21 20-18 33-10 18 28 8 41-34 15-46 2" />
        </svg>
        <div className="billCardHead">
          <span className="billBadge is-brand"><Star size={13} aria-hidden="true" /> اشتراک فرفرو</span>
          <span className="billBadge is-state">فعلاً رایگانه</span>
        </div>
        <b className="billCardTitle">فعلاً همه‌چی رایگانه</b>
        <p className="billCardSub">
          پرداخت هنوز باز نشده. از روزی که باز بشه، {toPersianDigits(overview.trialDays)} روز رایگان داری و از همون روز شمارشش شروع می‌شه. بعدش با یکی از این پلن‌ها ادامه می‌دی.
        </p>
        <ul className="billOffPlans">
          {overview.plans.map((plan) => (
            <li key={plan.id} className={plan.best ? "is-best" : ""}>
              <span className="billOffMain">
                <b>{plan.label}{plan.best ? <em>به‌صرفه‌ترین</em> : null}</b>
                <small>
                  {toPersianDigits(plan.days)} روز{plan.giftMonths ? `، که ${toPersianDigits(plan.giftMonths)} ماهش هدیه‌ست` : ""}
                </small>
              </span>
              <span className="billOffPrice">
                <b>{formatTomanNumber(plan.amountToman)} <small>تومان</small></b>
                <small>{plan.months > 1 ? `ماهی ${plan.monthlyApprox ? "حدود " : ""}${formatTomanNumber(plan.monthlyToman)}` : "ماهانه"}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="billCardNote">وقتی ماه رایگان تموم بشه، یه پیام برات میاد و چند روز وقت داری پلن بخری.</p>
      </div>
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
          <p>دلبخواهیه: اگه بخوای اشتراک یه آرتیست رو تو می‌دی؛ وگرنه هر آرتیست خودش می‌ده.</p>
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
