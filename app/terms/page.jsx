import { LegalPage } from "../legal/LegalPage";
import { termsContent } from "../legal/content";

export const metadata = {
  title: "قوانین و مقررات | زیبابان",
  description: "قوانین و مقررات استفاده از زیبابان.",
  alternates: {
    canonical: "/terms"
  }
};

export default function TermsPage() {
  return <LegalPage content={termsContent} />;
}
