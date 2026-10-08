import { LegalPage } from "../legal/LegalPage";
import { privacyContent } from "../legal/content";

export const metadata = {
  title: "حریم خصوصی | frfro",
  description: "سیاست حریم خصوصی frfro.",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />;
}
