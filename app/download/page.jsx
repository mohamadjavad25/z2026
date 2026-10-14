import { AppLanding } from "../features/landing/AppLanding";

export const metadata = {
  title: "دانلود اپلیکیشن فرفرو | frfro",
  description: "اپ فرفرو برای اندروید و آیفون: کشف سالن و آرتیست زیبایی با نمونه‌کار واقعی و رزرو مستقیم نوبت.",
  alternates: {
    canonical: "/download"
  }
};

export default function DownloadPage() {
  return <AppLanding />;
}
