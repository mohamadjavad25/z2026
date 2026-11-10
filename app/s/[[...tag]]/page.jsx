import { ProScreen } from "../../features/landing/ProScreen";
import { PLANS, TRIAL_DAYS, rialToToman } from "../../lib/billing/plans";
import { toPersianDigits } from "../../shared/lib/digits";

export const metadata = {
  title: "فرفرو برای سالن و آرتیست | frfro",
  description: "مشتری خودش نوبت می‌گیره، یادآوری و پیگیری با فرفرو.",
  alternates: { canonical: "/s" },
  robots: { index: false, follow: true }
};

/** Monthly price in thousands of toman with Persian digits («۵۰۰»), from the same plans the checkout charges from. */
function monthlyThousands(role) {
  const plan = PLANS.find((item) => item.role === role && item.months === 1);
  return plan ? toPersianDigits(String(Math.round(rialToToman(plan.amountRial) / 1000))) : "";
}

/**
 * Where an SMS to salon owners and artists leads (frfro.ir/s). One page that speaks to them, not to clients:
 * what frfro takes off their hands, then one button into the app. A letter after it (frfro.ir/s/a, /s/b) only
 * tags which message the visitor came from, so two texts can be compared (landing_visits, like /go).
 */
export default function ProPage() {
  return <ProScreen trialDays={toPersianDigits(String(TRIAL_DAYS))} salonPrice={monthlyThousands("salon")} artistPrice={monthlyThousands("artist")} />;
}
