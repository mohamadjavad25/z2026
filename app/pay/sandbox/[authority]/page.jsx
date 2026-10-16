import { SandboxBankClient } from "./SandboxBankClient";

export const metadata = {
  title: "درگاه آزمایشی | frfro",
  robots: { index: false, follow: false }
};

/** The pretend bank of the test gateway (FRFRO_PAYMENT_GATEWAY=sandbox). Off on a site with a real gateway (the API answers 404). */
export default async function SandboxBankPage({ params }) {
  const { authority } = await params;
  return <SandboxBankClient authority={String(authority || "")} />;
}
