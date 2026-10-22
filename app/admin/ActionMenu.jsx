"use client";

import { useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "../components/ui";

/** A small centred form: title, fields, cancel / submit. */
export function Dialog({ title, children, onClose, onSubmit, submitLabel, busy, disabled }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="admModal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="admCard admForm admDialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={(event) => { event.preventDefault(); if (!busy && !disabled) onSubmit(); }}>
        <h2>{title}</h2>
        {children}
        <div className="admDialogActions">
          <Button type="button" variant="secondary" onClick={onClose}>انصراف</Button>
          <Button type="submit" disabled={busy || disabled}>{submitLabel}</Button>
        </div>
      </form>
    </div>
  );
}

/** The «اقدام‌ها» sheet: the account's operations in groups, danger last. Picking one closes the sheet. */
export function ActionMenu({ items, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <div className="admModal admSheetWrap" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admCard admSheet" role="dialog" aria-modal="true" aria-label="اقدام‌ها">
        <header><h2>اقدام‌ها</h2><button type="button" className="admIconBtn" aria-label="بستن" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
        {!items.length ? <p className="admMuted"><ShieldCheck size={14} aria-hidden="true" /> این حساب مدیر است؛ از اینجا مسدود، حذف یا رمزش عوض نمی‌شود.</p> : null}
        {groups.map((group) => (
          <section key={group} className={group === "خطرناک" ? "admDanger" : ""}>
            <h3>{group}</h3>
            <ul>
              {items.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                const body = <><Icon size={17} aria-hidden="true" /> {item.label}</>;
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <a className={item.danger ? "is-danger" : ""} href={item.href} target="_blank" rel="noreferrer" onClick={onClose}>{body}</a>
                    ) : (
                      <button type="button" className={item.danger ? "is-danger" : ""} onClick={() => { if (!item.keep) onClose(); item.run(); }}>{body}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
