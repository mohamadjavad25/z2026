import VisitPage from "../page";

export const metadata = {
  title: "کاتالوگ فرفرو | frfro",
  description: "فرفرو برای سالن و آرتیست: نوبت آنلاین، یادآوری و پیگیری مشتری.",
  alternates: { canonical: "/v/clean" },
  robots: { index: false, follow: false }
};

/** frfro.ir/v/clean: the same catalog without screen pictures, each drawn as a clean stand-in (owner, 2026-11-13). */
export default function VisitCleanPage() {
  return <VisitPage plain />;
}
