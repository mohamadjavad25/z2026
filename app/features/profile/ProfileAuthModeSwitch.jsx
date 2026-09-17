import { LogIn, UserPlus } from "lucide-react";

export function ProfileAuthModeSwitch({ mode, onSignup, onLogin }) {
  return (
    <div className={`authModeSwitch ${mode === "login" ? "is-login" : "is-signup"}`} role="tablist" aria-label="ثبت‌نام یا ورود">
      <span className="authModeThumb" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={mode === "signup"}
        className={mode === "signup" ? "active" : ""}
        onClick={onSignup}
      >
        <span className="authModeIcon" aria-hidden="true"><UserPlus size={18} /></span>
        <span className="authModeCopy">
          <strong>ثبت‌نام</strong>
          <small>ساخت حساب جدید</small>
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "login"}
        className={mode === "login" ? "active" : ""}
        onClick={onLogin}
      >
        <span className="authModeIcon" aria-hidden="true"><LogIn size={18} /></span>
        <span className="authModeCopy">
          <strong>ورود</strong>
          <small>حسابت را باز کن</small>
        </span>
      </button>
    </div>
  );
}
