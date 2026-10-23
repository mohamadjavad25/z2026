import Link from "next/link";
import { Mascot } from "./Mascot";

/** Shown instead of a suspended salon's or artist's public page (no stack, no error page): one plain sentence. */
export function PageUnavailable() {
  return (
    <main className="errorPage">
      <div className="errorPage__inner">
        <Mascot pose="search" size={180} className="errorPage__mascot" />
        <p className="errorPage__logo" aria-hidden="true">frfro</p>
        <h1 className="errorPage__title">این صفحه فعلاً در دسترس نیست.</h1>
        <Link href="/" className="errorPage__back">برگرد به فرفرو</Link>
      </div>
    </main>
  );
}
