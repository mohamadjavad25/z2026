import { AppLanding } from "../features/landing/AppLanding";
import { APP_DOWNLOADS_OPEN } from "../features/landing/constants";

export const metadata = {
  title: APP_DOWNLOADS_OPEN ? "دانلود اپلیکیشن فرفرو | frfro" : "دربارهٔ فرفرو | frfro",
  description: "فرفرو رو از کافه‌بازار بگیر. سالن و آرتیست زیبایی رو با نمونه‌کار واقعی ببین و همون‌جا نوبت بگیر.",
  alternates: {
    canonical: "/download"
  }
};

export default function DownloadPage() {
  return <AppLanding />;
}
