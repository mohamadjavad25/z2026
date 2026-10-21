import { AppLanding } from "../features/landing/AppLanding";
import { APP_DOWNLOADS_OPEN } from "../features/landing/constants";

export const metadata = {
  title: APP_DOWNLOADS_OPEN ? "دانلود اپلیکیشن فرفرو | frfro" : "دربارهٔ فرفرو | frfro",
  description: "اپ فرفرو برای اندروید و آیفون: کشف سالن و آرتیست زیبایی با نمونه‌کار واقعی و رزرو مستقیم نوبت.",
  alternates: {
    canonical: "/download"
  }
};

export default function DownloadPage() {
  return <AppLanding />;
}
