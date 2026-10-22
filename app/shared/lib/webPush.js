/**
 * Before logout in a browser: this browser stops getting the account's notifications. Without it a shared computer
 * (a salon's front desk, a family phone) kept showing the old account's bookings and support replies after logout.
 * The next login subscribes again on its own when the permission is still granted (useHomeApp.jsx). The Android
 * app has its own counterpart, stopAppPush in nativePush.js. Never throws.
 */
export async function stopWebPush() {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    }).catch(() => null);
    await subscription.unsubscribe().catch(() => false);
  } catch {
    // logout must go on whatever happens here
  }
}
