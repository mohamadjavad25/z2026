"use client";

import { useEffect } from "react";
import { useHome } from "../shell/HomeContext";
import { PlanSheet } from "./PlanSheet";
import { PaymentResultSheet } from "./PaymentResultSheet";
import { PaymentsSheet } from "./PaymentsSheet";
import { SmsPackSheet } from "./SmsPackSheet";
import {
  closeBillingSheet,
  markPendingShown,
  openPaymentHistory,
  openPaymentResult,
  openPlans,
  openSmsPack,
  readPendingPayment,
  refreshBilling,
  resetBilling,
  useBilling
} from "./billingStore";

/**
 * The subscription sheets, mounted once in the home shell for salons and artists, plus the ways back from the bank:
 *   - /?billing=<id>    the result page's «بازگشت به فرفرو» link and the receipt push notification
 *   - /?billing=plans   a reminder push notification: straight to the plans
 *   - /?billing=history the push an artist gets when their salon paid for them: their receipts
 *   - /?billing=sms     straight to the SMS packs
 *   - a checkout this browser started (in the Android app the bank opens in the phone's browser): when the app is
 *     shown again, the result opens by itself, once.
 */
export function BillingHost() {
  const { createdProfile, authChecked } = useHome();
  const accountId = createdProfile?.id || null;
  const isPro = createdProfile?.type === "salon" || createdProfile?.type === "artist";
  const { overview, sheet } = useBilling();

  useEffect(() => {
    resetBilling();
    if (isPro) refreshBilling();
  }, [isPro, accountId]);

  useEffect(() => {
    if (!authChecked || !isPro) return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get("billing");
    if (!value) return;
    if (/^\d+$/.test(value)) openPaymentResult(value);
    else if (value === "plans") openPlans();
    else if (value === "history") openPaymentHistory();
    else if (value === "sms") openSmsPack();
    params.delete("billing");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  }, [authChecked, isPro]);

  useEffect(() => {
    if (!isPro) return undefined;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      refreshBilling();
      const pending = readPendingPayment();
      if (pending && !pending.shown) {
        markPendingShown();
        openPaymentResult(pending.id);
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [isPro]);

  if (!isPro) return null;
  // Paying for a team artist: that artist's plans and dates; gone from the team meanwhile → nothing to show.
  const forMember = sheet?.kind === "plans" && sheet.forUserId ? overview?.team?.find((member) => member.id === sheet.forUserId) || null : null;
  const planSheetOpen = sheet?.kind === "plans" && (sheet.forUserId ? Boolean(forMember?.plans?.length) : Boolean(overview?.plans?.length));
  return (
    <>
      <PlanSheet open={planSheetOpen} overview={overview} forMember={forMember} onClose={closeBillingSheet} />
      <SmsPackSheet open={sheet?.kind === "sms"} overview={overview} onClose={closeBillingSheet} />
      <PaymentResultSheet open={sheet?.kind === "result"} paymentId={sheet?.paymentId} onClose={closeBillingSheet} onRetry={openPlans} onRetryPack={openSmsPack} />
      <PaymentsSheet open={sheet?.kind === "history"} onClose={closeBillingSheet} />
    </>
  );
}
