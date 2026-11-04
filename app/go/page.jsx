import { GoScreen } from "../features/landing/GoScreen";

export const metadata = {
  title: "ورود به فرفرو | frfro",
  description: "سالن و آرتیست زیبایی رو پیدا کن و نوبت بگیر.",
  alternates: { canonical: "/go" },
  robots: { index: false, follow: true }
};

/** The link for the Instagram reel and bio (frfro.ir/go). One screen, one big button; ?s= tags where the visitor came from. */
export default function GoPage() {
  return <GoScreen />;
}
