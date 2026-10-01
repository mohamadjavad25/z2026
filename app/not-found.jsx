import Link from "next/link";

export const metadata = {
  title: "صفحه پیدا نشد | زیبابان"
};

export default function NotFound() {
  return (
    <main className="errorPage">
      <div className="errorPage__inner">
        <p className="errorPage__code">۴۰۴</p>
        <h1 className="errorPage__title">این صفحه پیدا نشد</h1>
        <p className="errorPage__desc">لینکی که دنبالش اومدی یا اشتباهه یا دیگه وجود نداره.</p>
        <Link href="/" className="errorPage__back">بازگشت به زیبابان</Link>
      </div>
    </main>
  );
}
