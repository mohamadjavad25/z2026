import { LegalPage } from "../legal/LegalPage";
import { privacyContent } from "../legal/content";

export const metadata = {
  title: "حریم خصوصی | فرفرو",
  description: "سیاست حریم خصوصی فرفرو.",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return <LegalPage content={privacyContent} />;
}
