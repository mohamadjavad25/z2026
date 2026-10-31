import Link from "next/link";
import { PLANS, SMS_INCLUDED_PER_MONTH, SMS_PACKS, TRIAL_DAYS, rialToToman } from "../lib/billing/plans";
import { toPersianDigits } from "../shared/lib/digits";

export const metadata = {
  title: "قیمت‌ها | frfro",
  description: "قیمت اشتراک سالن و آرتیست و بسته‌ی پیامک فرفرو. مشتری‌ها همیشه رایگان‌اند.",
  alternates: {
    canonical: "/pricing"
  }
};

const SUPPORT_EMAIL = "frfrosupport@gmail.com";
const SUPPORT_PHONE = "09030143721";
const ROLES = [
  { id: "salon", title: "اشتراک سالن" },
  { id: "artist", title: "اشتراک آرتیست" }
];

/** Toman with Persian digits and the Persian thousands mark, e.g. «۵۰۰٬۰۰۰ تومان». */
function toman(rial) {
  return `${toPersianDigits(rialToToman(rial).toLocaleString("en-US").replace(/,/g, "٬"))} تومان`;
}

/**
 * The public price list. Zarinpal (and the e-trust symbol) want the prices on the site itself. Every number comes from
 * app/lib/billing/plans.js, the same file the checkout charges from, so this page can never disagree with a payment.
 * A static server component, like /terms.
 */
export default function PricingPage() {
  return (
    <main className="legalPage">
      <div className="legalPage__inner pricePage">
        <Link href="/" className="legalPage__back">
          ← بازگشت به frfro
        </Link>
        <h1 className="legalPage__title">قیمت‌ها</h1>
        <p className="legalPage__intro">
          برای مشتری‌ها فرفرو همیشه رایگانه. سالن‌ها و آرتیست‌ها {toPersianDigits(TRIAL_DAYS)} روز رایگان امتحان می‌کنن و بعد یکی از اشتراک‌های زیر رو انتخاب می‌کنن. قیمت‌ها به تومانه.
        </p>

        {ROLES.map((role) => (
          <section key={role.id} className="legalPage__section pricePage__plans">
            <h2>{role.title}</h2>
            <ul className="pricePage__list">
              {PLANS.filter((plan) => plan.role === role.id).map((plan) => (
                <li key={plan.id}>
                  <span>
                    {plan.label}
                    {plan.giftMonths ? <small className="pricePage__gift">{toPersianDigits(plan.giftMonths)} ماه هدیه</small> : null}
                  </span>
                  <b>{toman(plan.amountRial)}</b>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="legalPage__section pricePage__plans">
          <h2>پیامک مشتری‌ها</h2>
          <p>
            هر ماه {toPersianDigits(SMS_INCLUDED_PER_MONTH)} پیامک برای مشتری‌هات توی اشتراکت هست و اول هر ماه دوباره پر می‌شه. اگه کم آوردی، بسته‌ی پیامک می‌خری. پیامک‌های بسته تموم نمی‌شن، مگر اینکه مصرفشون کنی.
          </p>
          <ul className="pricePage__list">
            {SMS_PACKS.map((pack) => (
              <li key={pack.id}>
                <span>{pack.title}</span>
                <b>{toman(pack.amountRial)}</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="legalPage__section">
          <h2>پرداخت و بازپرداخت</h2>
          <p>
            پرداخت از درگاه امن بانکی انجام می‌شه و رسیدش توی «پرداخت‌هام» هست. تا ۷ روز کاری بعد از پرداخت می‌تونی انصراف بدی؛ شرط‌ها و جزئیات بازپرداخت توی <Link href="/terms">قوانین و مقررات</Link> نوشته شده. پرداختی که بانک تأیید نکنه، معمولاً تا ۷۲ ساعت خودکار به حسابت برمی‌گرده.
          </p>
        </section>

        <footer className="legalPage__footer">
          <p>
            پشتیبانی: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · <a href={`tel:+98${SUPPORT_PHONE.slice(1)}`}>{toPersianDigits(SUPPORT_PHONE)}</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
