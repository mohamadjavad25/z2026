"use client";

import { Phone, Sparkles, UserRoundPlus, X } from "lucide-react";

/**
 * Salon owner — create staff form modal.
 * Presentational: role/status chips + submit handler from useSalonWorkspace.
 */
export function SalonCreateStaffModal({
  open,
  role,
  status,
  roleOptions = [],
  statusOptions = [],
  onClose,
  onRoleChange,
  onStatusChange,
  onSubmit
}) {
  if (!open) return null;

  return (
    <div
      className="artistProfileModal artistCreateModal"
      role="dialog"
      aria-modal="true"
      aria-label="ایجاد آرتیست"
      onClick={onClose}
    >
      <article className="artistProfileSheet artistCreateSheet" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="artistProfileClose" onClick={onClose} aria-label="بستن">
          <X size={18} />
        </button>

        <div className="artistProfileHero artistCreateHero">
          <div className="artistProfileAvatar" aria-hidden="true">
            <UserRoundPlus size={22} />
          </div>
          <div>
            <span>عضو جدید تیم</span>
            <b>ساخت پروفایل آرتیست</b>
          </div>
        </div>

        <form className="artistProfileForm artistCreatePopupForm" onSubmit={onSubmit}>
          <label>
            نام آرتیست
            <input name="name" placeholder="مثلاً مونا رضایی" required autoComplete="name" />
          </label>
          <label>
            شماره تماس
            <span className="artistCreateInputIcon"><Phone size={14} /></span>
            <input name="phone" placeholder="۰۹..." inputMode="tel" autoComplete="tel" />
          </label>

          <div className="artistCreateField wide">
            <span>حوزه فعالیت</span>
            <input type="hidden" name="role" value={role} />
            <div className="artistCreateChipGrid" role="group" aria-label="حوزه فعالیت">
              {roleOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={role === option ? "active" : ""}
                  aria-pressed={role === option}
                  onClick={() => onRoleChange?.(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <input type="hidden" name="shift" value={status} />

          <label className="wide">
            معرفی کوتاه
            <input name="bio" placeholder="مثلاً متخصص رنگ و احیا با ۵ سال تجربه" />
          </label>

          <button type="submit">
            <Sparkles size={16} aria-hidden="true" />
            ساخت پروفایل آرتیست
          </button>
        </form>
      </article>
    </div>
  );
}
