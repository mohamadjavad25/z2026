import { Check } from "lucide-react";

export function ProfileSignupSteps({ step }) {
  return (
    <div className={`profileStepBar is-${step}`} aria-label="مراحل ساخت پروفایل">
      <div className="profileStepHead">
        <span className="profileStepKicker">مسیر عضویت</span>
        <strong>{step === "form" ? "مرحله ۲ از ۳" : "مرحله ۱ از ۳"}</strong>
      </div>
      <ol className="profileStepList">
        <li className={step === "role" ? "is-active" : "is-done"}>
          <span className="profileStepDot" aria-hidden="true">
            {step === "role" ? <b>۱</b> : <Check size={15} strokeWidth={2.75} />}
          </span>
          <span className="profileStepCopy">
            <strong>انتخاب نقش</strong>
            <small>بانو، سالن یا آرتیست</small>
          </span>
        </li>
        <li className="profileStepBridge" aria-hidden="true">
          <i className={step === "form" ? "is-filled" : ""} />
        </li>
        <li className={step === "form" ? "is-active" : ""}>
          <span className="profileStepDot" aria-hidden="true"><b>۲</b></span>
          <span className="profileStepCopy">
            <strong>فرم کوتاه</strong>
            <small>اطلاعات پایه و رمز عبور</small>
          </span>
        </li>
        <li className="profileStepBridge" aria-hidden="true">
          <i />
        </li>
        <li>
          <span className="profileStepDot" aria-hidden="true"><b>۳</b></span>
          <span className="profileStepCopy">
            <strong>پروفایل آماده</strong>
            <small>ورود به دنیای زیبابان</small>
          </span>
        </li>
      </ol>
    </div>
  );
}
