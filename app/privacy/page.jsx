import { LegalPage } from "../legal/LegalPage";
import { privacyContent } from "../legal/content";

export const metadata = {
  title: "حریم خصوصی | Frfru",
  description: "سیاست حریم خصوصی Frfru.",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />;
}
