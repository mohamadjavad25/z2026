import { Check, Search, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";

/**
 * Drawn stand-ins for the screen pictures in frfro.ir/v/clean (owner, 2026-11-13: «یه نسخه بدون عکس هم باشه»).
 * Not copies of the app's screens: each keeps only the one thing the slide is about, with the app's real words.
 */

const TIMES = ["۱۰:۰۰", "۱۰:۳۰", "۱۱:۰۰", "۱۱:۳۰", "۱۲:۰۰", "۱۴:۰۰", "۱۴:۳۰", "۱۵:۰۰", "۱۶:۰۰"];
const FIND = [
  { icon: "haircut", label: "مو" },
  { icon: "manicure", label: "ناخن" },
  { icon: "lipstick", label: "میکاپ" },
  { icon: "eyebrow", label: "ابرو" },
  { icon: "facial", label: "پوست" },
  { icon: "bridal", label: "عروس" }
];

export function VisitMock({ name }) {
  if (name === "times") {
    return (
      <div className="vmock is-client" aria-hidden="true">
        <div className="vmock__chips">
          <span className="is-on">کوتاهی مو</span>
          <span>رنگ مو</span>
        </div>
        <div className="vmock__days">
          <span className="is-on">امروز</span><span>فردا</span><span>پس‌فردا</span>
        </div>
        <div className="vmock__times">
          {TIMES.map((time, i) => <span key={time} className={i === 1 ? "is-on" : ""}>{time}</span>)}
        </div>
        <span className="vmock__send">بفرست</span>
      </div>
    );
  }
  if (name === "request") {
    return (
      <div className="vmock is-pro" aria-hidden="true">
        <span className="vmock__tag">درخواست نوبت تازه</span>
        <b className="vmock__time">۱۰:۳۰</b>
        <div className="vmock__rows">
          <span><small>تاریخ</small>فردا</span>
          <span><small>خدمت</small><em><ServiceIcon emoji="haircut" size="xs" />کوتاهی مو</em></span>
        </div>
        <div className="vmock__answer">
          <span className="is-yes"><Check size={18} />تایید</span>
          <span className="is-no"><X size={18} />رد</span>
        </div>
      </div>
    );
  }
  if (name === "find") {
    return (
      <div className="vmock is-client" aria-hidden="true">
        <span className="vmock__search"><Search size={16} />اسم سالن یا آرتیست</span>
        <div className="vmock__cats">
          {FIND.map((item) => (
            <span key={item.icon}><ServiceIcon emoji={item.icon} size="md" />{item.label}</span>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
