import { LegalPage } from "../legal/LegalPage";
import { privacyContent } from "../legal/content";

export const metadata = {
  title: "حریم خصوصی | Farfaroo",
  description: "سیاست حریم خصوصی Farfaroo.",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />;
}
