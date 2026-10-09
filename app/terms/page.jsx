import { LegalPage } from "../legal/LegalPage";
import { termsContent } from "../legal/content";

export const metadata = {
  title: "قوانین و مقررات | Frfru",
  description: "قوانین و مقررات استفاده از Frfru.",
  alternates: {
    canonical: "/terms"
  }
};

export default function TermsPage() {
  return <LegalPage content={termsContent} />;
}
