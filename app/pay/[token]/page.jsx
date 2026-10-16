import { PayResultClient } from "./PayResultClient";

export const metadata = {
  title: "نتیجهٔ پرداخت | frfro",
  robots: { index: false, follow: false }
};

/**
 * Where the bank sends the payer back (through /api/billing/callback). Works without a login, because in the Android
 * app the bank opens in the phone's own browser: the long random token in the address is the key.
 */
export default async function PayResultPage({ params }) {
  const { token } = await params;
  return <PayResultClient token={String(token || "")} />;
}
