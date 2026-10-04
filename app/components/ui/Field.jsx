"use client";

import { useId } from "react";

/**
 * Label + control + hint + error, wired together for screen readers. Pass the
 * control as a render function so Field can hand it the id and aria props:
 *   <Field label="نام" error={err}>{(props) => <input {...props} />}</Field>
 */
export function Field({ label, hint, error, hideLabel = false, className = "", children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const controlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined
  };
  return (
    <div className={["ui-field", error ? "has-error" : "", className].filter(Boolean).join(" ")}>
      {label ? <label htmlFor={id} className={hideLabel ? "srOnly" : undefined}>{label}</label> : null}
      {children(controlProps)}
      {error ? <small id={errorId} className="ui-field-error" role="alert">{error}</small> : null}
      {hint ? <small id={hintId} className="ui-field-hint">{hint}</small> : null}
    </div>
  );
}
