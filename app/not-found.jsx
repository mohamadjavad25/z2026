import Link from "next/link";
import { Mascot } from "./components/Mascot";

export const metadata = {
  title: "صفحه پیدا نشد | frfro"
};

export default function NotFound() {
  return (
    <main className="errorPage">
      <div className="errorPage__inner">
        <Mascot pose="search" size={180} className="errorPage__mascot" />
        <p className="errorPage__logo" aria-hidden="true">frfro</p>
        <p className="errorPage__code">۴۰۴</p>
        <h1 className="errorPage__title">این صفحه پیدا نشد</h1>
        <p className="errorPage__desc">لینکی که دنبالش اومدی یا اشتباهه یا دیگه وجود نداره.</p>
        <Link href="/" className="errorPage__back">بازگشت به frfro</Link>
      </div>
    </main>
  );
}
