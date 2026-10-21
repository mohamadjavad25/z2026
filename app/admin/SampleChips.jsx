import { Sparkles } from "lucide-react";

/** A row of "example" chips above a form: one tap fills the fields with ready, on-brand content (see samples.js). Nothing is saved or sent by picking one. */
export function SampleChips({ items, onPick, label = "نمونه‌ها", hint = "با یک ضربه فرم را پر می‌کند؛ هر چه خواستی عوضش کن." }) {
  return (
    <div className="admSamples" role="group" aria-label={label}>
      <span className="admSamplesLabel"><Sparkles size={14} aria-hidden="true" /> {label}</span>
      <div className="admSamplesRow">
        {items.map((item) => (
          <button key={item.id || item.label || item.title} type="button" title={hint} onClick={() => onPick(item)}>{item.label || item.title}</button>
        ))}
      </div>
    </div>
  );
}
