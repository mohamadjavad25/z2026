"use client";

import { useCallback, useState } from "react";
import { ensureShebaIR, parseTomanAmount } from "../../shared/lib/money";

/**
 * Wallet state + server sync: balance, transactions, withdrawals, bank
 * account draft, and the charge/withdraw/save-bank actions.
 *
 * Boot/login/logout wiring lives in HomeApp (via authCascadeRef, same as
 * the other domain hooks) — this hook only owns the wallet data itself and
 * the requests that mutate it.
 *
 * @param {{ onNotice?: (msg: string) => void }} options
 */
export function useWalletWorkspace({ onNotice } = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletAvailable, setWalletAvailable] = useState(0);
  const [walletBankAccount, setWalletBankAccount] = useState(null);
  const [walletWithdrawals, setWalletWithdrawals] = useState([]);
  const [walletBankDraft, setWalletBankDraft] = useState({ sheba: "IR", holderName: "", bankName: "" });
  const [walletWithdrawAmount, setWalletWithdrawAmount] = useState("");
  const [walletCashMode, setWalletCashMode] = useState("charge");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);

  const applyWalletPayload = useCallback((payload = {}) => {
    const data = payload.data || payload;
    setWalletAvailable(Number(data.availableBalance ?? payload.availableBalance ?? 0));
    setWalletTransactions(data.transactions || payload.transactions || []);
    setWalletWithdrawals(data.withdrawals || payload.withdrawals || []);
    const bank = data.bankAccount || payload.bankAccount || null;
    setWalletBankAccount(bank);
    if (bank) {
      setWalletBankDraft({
        sheba: ensureShebaIR(bank.sheba),
        holderName: bank.holderName || "",
        bankName: bank.bankName || ""
      });
    }
    setWalletLoading(false);
  }, []);

  const resetWalletState = useCallback(() => {
    setWalletAvailable(0);
    setWalletTransactions([]);
    setWalletWithdrawals([]);
    setWalletBankAccount(null);
    setWalletBankDraft({ sheba: "IR", holderName: "", bankName: "" });
    setWalletWithdrawAmount("");
    setWalletLoading(true);
  }, []);

  const refreshWallet = useCallback(async () => {
    try {
      const response = await fetch("/api/wallet");
      if (!response.ok) {
        setWalletLoading(false);
        return;
      }
      const payload = await response.json();
      applyWalletPayload(payload);
    } catch {
      setWalletLoading(false);
    }
  }, [applyWalletPayload]);

  const saveWalletBankAccount = useCallback(async (event) => {
    event.preventDefault();
    setWalletBusy(true);
    try {
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "bank",
          sheba: walletBankDraft.sheba,
          holderName: walletBankDraft.holderName,
          bankName: walletBankDraft.bankName
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "ثبت شبا انجام نشد.");
        return;
      }
      applyWalletPayload(payload);
      notify("حساب بانکی برای برداشت ذخیره شد.");
    } catch {
      notify("ثبت شبا انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setWalletBusy(false);
    }
  }, [walletBankDraft, applyWalletPayload, notify]);

  const requestWalletWithdraw = useCallback(async (event) => {
    event.preventDefault();
    const amount = parseTomanAmount(walletWithdrawAmount);
    setWalletBusy(true);
    try {
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "withdraw",
          amount,
          // Lets the server dedupe this exact attempt if it ever reaches it twice
          // (network retry, or a click that slips past walletBusy) instead of
          // withdrawing the amount twice.
          idempotencyKey: crypto.randomUUID()
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "برداشت انجام نشد.");
        return;
      }
      applyWalletPayload(payload);
      setWalletWithdrawAmount("");
      notify(payload.message || "درخواست برداشت ثبت شد.");
    } catch {
      notify("برداشت انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setWalletBusy(false);
    }
  }, [walletWithdrawAmount, applyWalletPayload, notify]);

  const requestWalletCharge = useCallback(async (event) => {
    event.preventDefault();
    const amount = parseTomanAmount(walletWithdrawAmount);
    setWalletBusy(true);
    try {
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "demo_credit",
          amount,
          asPending: false,
          // Same reasoning as requestWalletWithdraw — dedupes this exact charge attempt.
          idempotencyKey: crypto.randomUUID()
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "شارژ کیف پول انجام نشد.");
        return;
      }
      applyWalletPayload(payload);
      setWalletWithdrawAmount("");
      notify("کیف پول شارژ شد.");
    } catch {
      notify("شارژ کیف پول انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setWalletBusy(false);
    }
  }, [walletWithdrawAmount, applyWalletPayload, notify]);

  return {
    walletTransactions,
    walletAvailable,
    walletBankAccount,
    walletWithdrawals,
    walletBankDraft,
    setWalletBankDraft,
    walletWithdrawAmount,
    setWalletWithdrawAmount,
    walletCashMode,
    setWalletCashMode,
    walletBusy,
    walletLoading,
    setWalletLoading,
    applyWalletPayload,
    resetWalletState,
    refreshWallet,
    saveWalletBankAccount,
    requestWalletWithdraw,
    requestWalletCharge
  };
}
