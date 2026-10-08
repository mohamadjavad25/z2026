import { ChevronRight } from "lucide-react";

/**
 * List on one side, the selected item's details on the other, both visible at once on a wide screen.
 * On a narrow screen the details slide over the list as a full page with a clear "back to the list" button.
 */
export function SplitView({ list, detail, open, onClose, label, emptyHint = "یک مورد را از فهرست انتخاب کن." }) {
  return (
    <div className={`admSplit${open ? " has-detail" : ""}`}>
      <div className="admSplitList">{list}</div>
      <aside className="admSplitDetail" aria-label={label}>
        <button type="button" className="admSplitBack" onClick={onClose}>
          <ChevronRight size={18} aria-hidden="true" /> بازگشت به فهرست
        </button>
        {open ? detail : <div className="admSplitEmpty"><p>{emptyHint}</p></div>}
      </aside>
    </div>
  );
}
