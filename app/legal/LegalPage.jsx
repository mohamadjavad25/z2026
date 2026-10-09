import Link from "next/link";

/** Shared renderer for /terms and /privacy -- both are static, read-only
 *  content (no client interactivity needed), so this stays a plain server
 *  component. */
export function LegalPage({ content }) {
  return (
    <main className="legalPage">
      <div className="legalPage__inner">
        <Link href="/" className="legalPage__back">
          ← بازگشت به Frfru
        </Link>
        <h1 className="legalPage__title">{content.title}</h1>
        <p className="legalPage__updated">آخرین به‌روزرسانی: {content.lastUpdated}</p>
        <p className="legalPage__intro">{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className="legalPage__section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              // Index-keyed: paragraph text isn't guaranteed unique within
              // a section (short "· ..." list lines repeat structurally)
              // and this content never reorders.
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}
        {content.footer?.length ? (
          <footer className="legalPage__footer">
            {content.footer.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </footer>
        ) : null}
      </div>
    </main>
  );
}
