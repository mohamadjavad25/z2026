/**
 * Wallet API environment guards (safe to import outside Next.js).
 */

export function isDemoCreditBlocked() {
  return process.env.NODE_ENV === "production";
}

export function getWalletAdminToken() {
  return String(process.env.ZIBABAN_WALLET_ADMIN_TOKEN || "").trim();
}
