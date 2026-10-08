/** Every page starts the same way: what this page is, in one line, and (optionally) the main actions. */
export function PageHead({ title, desc, children }) {
  return (
    <header className="admPageHead">
      <div>
        <h1>{title}</h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {children ? <div className="admPageActions">{children}</div> : null}
    </header>
  );
}
