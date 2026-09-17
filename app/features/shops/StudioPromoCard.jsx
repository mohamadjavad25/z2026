"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { StudioInfoCard } from "./StudioInfoCard";
import { PROMO_CARD_ICONS, PROMO_CARD_TONES, getPromoCardIcon } from "./promoCardTypes";

/**
 * Owner-side library for the shop's promo cards: a real list the owner
 * builds up (own icon + color per card), picks one to be "active" (shown
 * on both the dashboard and the public storefront), and can delete any of.
 * "تغییر"/"افزودن" open a modal: step "manage" lists every saved card
 * (tap = activate, trash = delete) with an "افزودن کارت جدید" entry that
 * swaps to step "create" (icon + color picker, live preview, text fields).
 */
export function StudioPromoCard({ cards = [], busy, onCreate, onActivate, onDelete }) {
  const [step, setStep] = useState("closed"); // "closed" | "manage" | "create"
  const [icon, setIcon] = useState(PROMO_CARD_ICONS[0].key);
  const [tone, setTone] = useState(PROMO_CARD_TONES[0].key);
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [modalRoot, setModalRoot] = useState(null);

  useEffect(() => {
    setModalRoot(document.body);
  }, []);

  useEffect(() => {
    if (step === "closed") return undefined;
    // The dashboard's own scroll container is .studioPage, not <body> — and
    // its overflow is set with !important elsewhere, so only a class (see
    // .studioModalOpen in shop-owner-studio.css) can override it, not an
    // inline style — lock that instead so the sheet doesn't leave the page
    // scrolling behind it.
    const scrollRoot = document.querySelector(".studioPage");
    if (!scrollRoot) return undefined;
    scrollRoot.classList.add("studioModalOpen");
    return () => {
      scrollRoot.classList.remove("studioModalOpen");
    };
  }, [step]);

  const activeCard = cards.find((card) => card.active) || null;
  const activeToneSwatch = PROMO_CARD_TONES.find((entry) => entry.key === tone)?.swatch || "#7c2740";

  function openManage() {
    setStep("manage");
  }

  function closeModal() {
    setStep("closed");
  }

  function openCreate() {
    setIcon(PROMO_CARD_ICONS[0].key);
    setTone(PROMO_CARD_TONES[0].key);
    setPrimary("");
    setSecondary("");
    setStep("create");
  }

  async function handleCreate(event) {
    event.preventDefault();
    const trimmedPrimary = primary.trim();
    if (!icon || !tone || !trimmedPrimary) return;
    const ok = await onCreate({ icon, tone, primary: trimmedPrimary, secondary: secondary.trim() });
    if (ok) setStep("manage");
  }

  return (
    <>
      {activeCard ? (
        <StudioInfoCard
          icon={getPromoCardIcon(activeCard.icon)}
          tone={activeCard.tone}
          value={activeCard.primary}
          label={activeCard.secondary || ""}
          actionLabel="مدیریت"
          onAction={openManage}
        />
      ) : cards.length > 0 ? (
        <button type="button" className="studioPromoCardEmpty" onClick={openManage}>
          <Plus size={16} />
          یکی از کارت‌هات رو فعال کن
        </button>
      ) : (
        <button type="button" className="studioPromoCardEmpty" onClick={openCreate}>
          <Plus size={16} />
          افزودن کارت ویژه (تخفیف، ارسال رایگان و…)
        </button>
      )}

      {step === "manage" && modalRoot ? createPortal(
        <div className="studioPromoModal" role="dialog" aria-modal="true" aria-label="کارت‌های ویژه" onClick={closeModal}>
          <section className="studioPromoSheet" onClick={(event) => event.stopPropagation()}>
            <div className="studioPromoSheetHandle" />
            <div className="studioPromoSheetHead">
              <h3>کارت‌های ویژه</h3>
              <button type="button" className="studioPromoSheetClose" onClick={closeModal} aria-label="بستن">
                <X size={16} />
              </button>
            </div>

            {cards.length > 0 ? (
              <div className="studioPromoPickList">
                {cards.map((card) => (
                  <div className="studioPromoListRow" key={card.id}>
                    <button
                      type="button"
                      className={`studioPromoPickItem ${card.active ? "is-active" : ""}`}
                      onClick={() => !card.active && onActivate(card.id)}
                      disabled={busy}
                    >
                      <StudioInfoCard
                        icon={getPromoCardIcon(card.icon)}
                        tone={card.tone}
                        value={card.primary}
                        label={card.secondary || ""}
                      />
                      {card.active ? (
                        <span className="studioPromoActiveBadge">
                          <Check size={12} />
                          فعال
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="studioPromoListDelete"
                      aria-label={`حذف کارت ${card.primary}`}
                      onClick={() => onDelete(card.id)}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="studioPromoEmptyNote">هنوز کارتی نساختی — یکی اضافه کن تا روی پنل و صفحه فروشگاهت نمایش داده بشه.</p>
            )}

            <button type="button" className="studioPromoCardEmpty" onClick={openCreate}>
              <Plus size={16} />
              افزودن کارت جدید
            </button>
          </section>
        </div>,
        modalRoot
      ) : null}

      {step === "create" && modalRoot ? createPortal(
        <div className="studioPromoModal" role="dialog" aria-modal="true" aria-label="کارت جدید" onClick={closeModal}>
          <section className="studioPromoSheet" onClick={(event) => event.stopPropagation()}>
            <div className="studioPromoSheetHandle" />
            <div className="studioPromoSheetHead">
              <button type="button" className="studioPromoSheetBack" onClick={() => setStep("manage")} aria-label="بازگشت به کارت‌ها">
                <ChevronRight size={17} />
              </button>
              <h3>کارت جدید</h3>
              <button type="button" className="studioPromoSheetClose" onClick={closeModal} aria-label="بستن">
                <X size={16} />
              </button>
            </div>

            <StudioInfoCard
              icon={getPromoCardIcon(icon)}
              tone={tone}
              value={primary || "پیش‌نمایش کارت"}
              label={secondary || "متن توضیح اینجا میاد"}
            />

            <form className="studioPromoCardForm" onSubmit={handleCreate}>
              <span className="studioPromoFormLabel">آیکن</span>
              <div className="studioPromoIconGrid" style={{ "--swatch": activeToneSwatch }}>
                {PROMO_CARD_ICONS.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={`studioPromoIconChip ${icon === entry.key ? "is-active" : ""}`}
                      aria-label={entry.key}
                      onClick={() => setIcon(entry.key)}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
              </div>

              <span className="studioPromoFormLabel">رنگ</span>
              <div className="studioPromoToneGrid">
                {PROMO_CARD_TONES.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`studioPromoToneSwatch ${tone === entry.key ? "is-active" : ""}`}
                    style={{ "--swatch": entry.swatch }}
                    aria-label={entry.label}
                    onClick={() => setTone(entry.key)}
                  />
                ))}
              </div>

              <input
                value={primary}
                onChange={(event) => setPrimary(event.target.value)}
                placeholder="مثلاً ۲۰٪ تخفیف"
                maxLength={40}
                aria-label="متن اصلی کارت"
                required
              />
              <input
                value={secondary}
                onChange={(event) => setSecondary(event.target.value)}
                placeholder="توضیح کوتاه (اختیاری)"
                maxLength={60}
                aria-label="توضیح کارت"
              />

              <div className="studioPromoCardFormActions">
                <button type="submit" className="studioButton" disabled={busy || !primary.trim()}>
                  <Check size={14} />
                  ذخیره
                </button>
              </div>
            </form>
          </section>
        </div>,
        modalRoot
      ) : null}
    </>
  );
}
