import { LegalPage } from "../legal/LegalPage";
import { privacyContent } from "../legal/content";

export const metadata = {
  title: "حریم خصوصی | زیبابان",
  description: "سیاست حریم خصوصی زیبابان.",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />;
}
