"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Clock, Copy, Eye, EyeOff, Landmark, Pencil, Plus, Receipt, User, Wallet, X } from "lucide-react";
import { SkeletonList } from "../../components/Skeleton";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { toLatinDigits } from "../../shared/lib/digits";
import { formatChatDayLabel } from "../../shared/lib/chatTime";
import { ensureShebaIR, parseTomanAmount } from "../../shared/lib/money";

const WITHDRAW_STATUS = {
  paid: { label: "واریز شد", icon: Check, tone: "is-paid" },
  pending: { label: "در انتظار", icon: Clock, tone: "is-pending" },
  processing: { label: "در حال واریز", icon: Clock, tone: "is-pending" },
  failed: { label: "ناموفق", icon: X, tone: "is-failed" },
  rejected: { label: "رد شد", icon: X, tone: "is-failed" }
};

function latinNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("en-US");
}

function rowDateLabel(value) {
  return toLatinDigits(formatChatDayLabel(value));
}

export function WalletPage({
  profileType,
  walletAvailable,
  walletBankAccount,
  walletBankDraft,
  setWalletBankDraft,
  walletBusy,
  walletLoading = false,
  walletCashMode,
  setWalletCashMode,
  walletWithdrawAmount,
  setWalletWithdrawAmount,
  walletWithdrawals,
  walletTransactions,
  onSaveBankAccount,
  onCharge,
  onWithdraw
}) {
  const [shebaCopied, setShebaCopied] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const hasBusinessWallet = profileType === "artist" || profileType === "salon" || profileType === "shop";
  const bankFormExpanded = bankFormOpen || !walletBankAccount;
  const balanceText = latinNumber(walletAvailable);
  const balanceDisplay = balanceHidden ? balanceText.replace(/\d/g, "0") : balanceText;

  async function handleCopySheba() {
    const value = walletBankDraft.sheba || "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setShebaCopied(true);
      setTimeout(() => setShebaCopied(false), 1500);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }

  return (
    <div className="walletPage">
      {hasBusinessWallet && (
        <>
          <section className="walletBlock walletBalanceCard" aria-label="موجودی کیف پول">
            <div className="walletBalanceRow">
              <span className="walletBalanceIcon">
                <Wallet size={18} />
              </span>
              <div className="walletBalanceFigure">
                <span>موجودی کیف پول</span>
                <div className="walletBalanceValue">
                  <b>{balanceDisplay}</b>
                  <em>تومان</em>
                </div>
              </div>
              <button
                type="button"
                className="walletBalanceEyeBtn"
                onClick={() => setBalanceHidden((value) => !value)}
                aria-label={balanceHidden ? "نمایش موجودی" : "پنهان کردن موجودی"}
              >
                {balanceHidden ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <hr className="walletHairline" />

            <form className="walletBankForm" onSubmit={onSaveBankAccount}>
              <div className="walletBankFormHead">
                <button
                  type="button"
                  className="walletBankFormToggle"
                  onClick={() => setBankFormOpen((value) => !value)}
                  aria-expanded={bankFormExpanded}
                >
                  <ChevronDown size={15} className={bankFormExpanded ? "is-open" : ""} />
                  اطلاعات حساب برداشت
                </button>
                <button
                  type="submit"
                  className="walletEditBtn"
                  aria-label={walletBankAccount ? "ویرایش حساب بانکی" : "ثبت حساب بانکی"}
                  disabled={walletBusy}
                >
                  <Pencil size={14} />
                </button>
              </div>

              {bankFormExpanded && (
                <>
                  <label className="walletField is-sheba">
                    <span>
                      <Landmark size={13} />
                      شماره شبا
                    </span>
                    <div className="walletFieldInputRow">
                      <input
                        value={walletBankDraft.sheba}
                        onChange={(event) => setWalletBankDraft((prev) => ({ ...prev, sheba: ensureShebaIR(event.target.value) }))}
                        onBlur={() => setWalletBankDraft((prev) => ({ ...prev, sheba: ensureShebaIR(prev.sheba) }))}
                        placeholder="IR000000000000000000000000"
                        autoComplete="off"
                        inputMode="numeric"
                        dir="ltr"
                        spellCheck={false}
                        required
                      />
                      <button
                        type="button"
                        className="walletCopyBtn"
                        onClick={handleCopySheba}
                        aria-label="کپی شماره شبا"
                        disabled={!walletBankDraft.sheba}
                      >
                        {shebaCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </label>
                  <div className="walletFieldRow">
                    <label className="walletField">
                      <span>
                        <User size={13} />
                        صاحب حساب
                      </span>
                      <input
                        value={walletBankDraft.holderName}
                        onChange={(event) => setWalletBankDraft((prev) => ({ ...prev, holderName: event.target.value }))}
                        placeholder="نام صاحب حساب"
                        autoComplete="name"
                        dir="rtl"
                        required
                      />
                    </label>
                    <label className="walletField">
                      <span>بانک</span>
                      <input
                        value={walletBankDraft.bankName}
                        onChange={(event) => setWalletBankDraft((prev) => ({ ...prev, bankName: event.target.value }))}
                        placeholder="نام بانک"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                </>
              )}
            </form>

            {!walletBankAccount ? (
              <p className="walletInlineHint">اول حساب بانکی را ثبت کن، بعد می‌تونی برداشت بزنی.</p>
            ) : null}
          </section>

          <section className="walletBlock">
            <form
              className={`walletCashForm is-${walletCashMode}`}
              onSubmit={walletCashMode === "charge" ? onCharge : onWithdraw}
            >
              <div className="walletCashTabs" role="tablist" aria-label="نوع عملیات کیف پول">
                <span className="walletCashTabsThumb" aria-hidden="true" />
                <button
                  type="button"
                  role="tab"
                  aria-selected={walletCashMode === "charge"}
                  className={walletCashMode === "charge" ? "active" : ""}
                  onClick={() => setWalletCashMode("charge")}
                >
                  <Plus size={15} />
                  شارژ
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={walletCashMode === "withdraw"}
                  className={walletCashMode === "withdraw" ? "active" : ""}
                  onClick={() => setWalletCashMode("withdraw")}
                >
                  <Wallet size={15} />
                  برداشت
                </button>
              </div>
              <div className="walletCashBox">
                <div className="walletCashSummary">
                  <span>{walletCashMode === "charge" ? "شارژ کیف پول" : "برداشت به شبا"}</span>
                  <b>
                    {walletCashMode === "charge"
                      ? "افزایش موجودی قابل‌برداشت"
                      : `${latinNumber(walletAvailable)} تومان`}
                  </b>
                </div>
                <label className="walletField walletAmountField">
                  <span>مبلغ (تومان)</span>
                  <input
                    value={walletWithdrawAmount}
                    onChange={(event) => setWalletWithdrawAmount(event.target.value)}
                    inputMode="numeric"
                    placeholder="250,000"
                    dir="ltr"
                    required
                    disabled={walletCashMode === "withdraw" && !walletBankAccount}
                  />
                </label>
                <div className="walletQuickAmounts" aria-label="مبلغ‌های سریع">
                  {[100000, 250000, 500000].map((amount) => {
                    const active = parseTomanAmount(walletWithdrawAmount) === amount;
                    return (
                      <button
                        type="button"
                        key={amount}
                        className={active ? "active" : ""}
                        onClick={() => setWalletWithdrawAmount(amount.toLocaleString("en-US"))}
                      >
                        {latinNumber(amount)}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="submit"
                  className="walletPrimaryBtn"
                  disabled={
                    walletBusy
                    || parseTomanAmount(walletWithdrawAmount) <= 0
                    || (walletCashMode === "withdraw" && (!walletBankAccount || walletAvailable <= 0))
                  }
                >
                  {walletCashMode === "charge" ? "شارژ کیف پول" : "درخواست برداشت"}
                </button>
              </div>
            </form>
          </section>

          {walletWithdrawals.length > 0 && (
            <section className="walletBlock" aria-label="برداشت‌های اخیر">
              <header className="walletBlockHead">
                <h3>برداشت‌های اخیر</h3>
              </header>
              <div className="walletRowList">
                {walletWithdrawals.slice(0, 5).map((item) => {
                  const meta = WITHDRAW_STATUS[item.status] || { label: item.status, icon: Clock, tone: "is-pending" };
                  const StatusIcon = meta.icon;
                  const dateLabel = rowDateLabel(item.created_at);
                  return (
                    <article key={item.id} className="walletRow">
                      <span className={`walletRowIcon ${meta.tone}`}>
                        <StatusIcon size={15} />
                      </span>
                      <div className="walletRowBody">
                        <strong>{latinNumber(item.amount)} تومان</strong>
                        <small>{[item.note || "برداشت به شبا", dateLabel].filter(Boolean).join(" · ")}</small>
                      </div>
                      <em className={meta.tone}>{meta.label}</em>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <section className="walletBlock walletLedger" aria-label="تراکنش‌ها">
        <header className="walletBlockHead">
          <h3>تراکنش‌ها</h3>
          <p>آخرین حرکت‌های کیف پول</p>
        </header>
        <div className="walletRowList">
          {walletLoading ? (
            <SkeletonList rows={4} variant="list" label="در حال بارگذاری تراکنش‌ها" />
          ) : walletTransactions.length === 0 ? (
            <ProfileEmptyState
              className="walletEmptyState"
              role="status"
              icon={Receipt}
              title="هنوز تراکنشی ثبت نشده"
              description="با شارژ کیف پول، حرکت‌های مالی اینجا دیده می‌شوند."
            />
          ) : (
            walletTransactions.slice(0, 10).map((item) => {
              const isIn = item.amount >= 0;
              const dateLabel = rowDateLabel(item.created_at);
              return (
                <article key={`${item.id}-${item.created_at}`} className="walletRow">
                  <span className={`walletRowIcon ${isIn ? "is-in" : "is-out"}`}>
                    {isIn ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </span>
                  <div className="walletRowBody">
                    <strong>{item.note || item.type}</strong>
                    <small>{[dateLabel, "تومان"].filter(Boolean).join(" · ")}</small>
                  </div>
                  <b className={isIn ? "is-in" : "is-out"}>
                    {`${isIn ? "+" : "−"}${latinNumber(Math.abs(item.amount))}`}
                  </b>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
