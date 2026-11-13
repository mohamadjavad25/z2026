import { VisitScreen } from "../features/landing/VisitScreen";
import { PLANS, SMS_INCLUDED_PER_MONTH, TRIAL_DAYS, rialToToman } from "../lib/billing/plans";
import { toPersianDigits } from "../shared/lib/digits";

export const metadata = {
  title: "کاتالوگ فرفرو | frfro",
  description: "فرفرو برای سالن و آرتیست: نوبت آنلاین، یادآوری و پیگیری مشتری.",
  alternates: { canonical: "/v" },
  robots: { index: false, follow: false }
};

const toman = (rial) => `${toPersianDigits(rialToToman(rial).toLocaleString("en-US").replace(/,/g, "٬"))} تومان`;

function planRows(role) {
  return PLANS.filter((plan) => plan.role === role).map((plan) => ({
    id: plan.id,
    label: plan.label,
    price: toman(plan.amountRial),
    gift: plan.giftMonths ? `${toPersianDigits(String(plan.giftMonths))} ماه هدیه` : ""
  }));
}

function monthlyThousands(role) {
  const plan = PLANS.find((item) => item.role === role && item.months === 1);
  return plan ? toPersianDigits(String(Math.round(rialToToman(plan.amountRial) / 1000))) : "";
}

/**
 * frfro.ir/v: the catalog field visitors show salons and artists in person (owner, 2026-11-13). Prices and free days
 * come from plans.js, the same file the checkout charges from, so the catalog never disagrees with a payment.
 */
export default function VisitPage({ plain = false }) {
  return (
    <VisitScreen
      trialDays={toPersianDigits(String(TRIAL_DAYS))}
      smsPerMonth={toPersianDigits(String(SMS_INCLUDED_PER_MONTH))}
      plans={{ salon: planRows("salon"), artist: planRows("artist") }}
      monthly={{ salon: monthlyThousands("salon"), artist: monthlyThousands("artist") }}
      plain={plain === true}
    />
  );
}
