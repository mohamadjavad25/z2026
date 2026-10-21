import { useEffect } from "react";
import { ChevronRight } from "lucide-react";

/**
 * The list uses the full width. Picking an item slides its details in from the side (a full page on a phone), with a
 * clear "back to the list" button; Esc or a tap outside closes it.
 */
export function SplitView({ list, detail, open, onClose, label }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={`admSplit${open ? " has-detail" : ""}`}>
      <div className="admSplitList">{list}</div>
      {open ? <div className="admSplitScrim" onClick={onClose} aria-hidden="true" /> : null}
      <aside className="admSplitDetail" aria-label={label} aria-hidden={!open}>
        <button type="button" className="admSplitBack" onClick={onClose}>
          <ChevronRight size={18} aria-hidden="true" /> بازگشت به فهرست
        </button>
        {open ? detail : null}
      </aside>
    </div>
  );
}
