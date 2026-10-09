import { LegalPage } from "../legal/LegalPage";
import { termsContent } from "../legal/content";

export const metadata = {
  title: "قوانین و مقررات | frfro",
  description: "قوانین و مقررات استفاده از frfro.",
  alternates: {
    canonical: "/terms"
  }
};

export default function TermsPage() {
  return <LegalPage content={termsContent} />;
}
