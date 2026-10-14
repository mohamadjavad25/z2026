"use client";

import { SheetClose } from "./SheetClose";

/**
 * «درباره» bottom sheet shared by the public salon and artist pages.
 * It sits above the page's bottom bar; the close button is the shared SheetClose.
 * `stats`: [{ icon, value, label }]  `rows`: [{ icon, label, value, ltr }]
 * `children`: extra blocks (hours, rules) rendered after the rows.
 */
export function PublicAboutSheet({ kicker, name, avatar, avatarPosition = "50% 50%", bio = "", emptyBio = "", stats = [], rows = [], onClose, children }) {
  const visibleRows = rows.filter((row) => row && row.value);
  return (
    <div className="pasOverlay" role="dialog" aria-modal="true" aria-label={`${kicker} ${name || ""}`.trim()} onClick={onClose}>
      <article className="pasSheet" onClick={(event) => event.stopPropagation()}>
        <header className="pasHead">
          {avatar ? <img src={avatar} alt="" aria-hidden="true" style={{ objectPosition: avatarPosition }} /> : null}
          <div>
            <span>{kicker}</span>
            <h3>{name}</h3>
          </div>
        </header>

        {bio ? <p className="pasBio">{bio}</p> : <p className="pasBio is-empty">{emptyBio}</p>}

        {stats.length ? (
          <div className="pasStats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {visibleRows.length ? (
          <ul className="pasRows">
            {visibleRows.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.label}>
                  <i aria-hidden="true"><Icon size={18} /></i>
                  <div>
                    <small>{row.label}</small>
                    <b dir={row.ltr ? "ltr" : undefined}>{row.value}</b>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {children}
        <SheetClose onClick={onClose} />
      </article>
    </div>
  );
}
