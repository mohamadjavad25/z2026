import { tabInfo } from "./nav";

/** Every page starts the same way: what this page is, in one line, and (optionally) the main actions. Pass `tab` to use the page's own name and line. */
export function PageHead({ tab, title, desc, children }) {
  const info = tab ? tabInfo(tab) : null;
  return (
    <header className="admPageHead">
      <div>
        <h1>{title || info?.label}</h1>
        {desc || info?.desc ? <p>{desc || info.desc}</p> : null}
      </div>
      {children ? <div className="admPageActions">{children}</div> : null}
    </header>
  );
}
