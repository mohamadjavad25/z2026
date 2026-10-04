"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";

/**
 * Multi-select "specialty/service" dropdown for the salon/artist signup
 * forms. Renders a single text field to the backend (comma-joined, same
 * `service` column every other form field already writes to) via a plain
 * text input kept off-screen (not type="hidden" -- hidden inputs skip HTML5
 * constraint validation, and `required` needs to keep working here the same
 * way it did on the old single <select>).
 */
export function SpecialtyMultiSelect({ name, placeholder, options, required, defaultValue = "" }) {
  const initial = String(defaultValue || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initial);
  // Previously saved values that aren't in the preset list stay selectable.
  const [extraOptions, setExtraOptions] = useState(() => initial.filter((item) => !options.includes(item)));
  const [draft, setDraft] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const allOptions = [...options, ...extraOptions];

  function toggleOption(option) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
  }

  function addCustomOption() {
    const value = draft.trim();
    if (!value) return;
    if (!allOptions.includes(value)) {
      setExtraOptions((prev) => [...prev, value]);
    }
    if (!selected.includes(value)) {
      setSelected((prev) => [...prev, value]);
    }
    setDraft("");
  }

  return (
    <div className="specialtySelect" ref={containerRef}>
      <button
        type="button"
        className="specialtySelectTrigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected.length ? "" : "is-placeholder"}>
          {selected.length ? selected.join("، ") : placeholder}
        </span>
        <ChevronDown size={16} className="specialtySelectChevron" data-open={open} />
      </button>

      {/* Off-screen but focusable/validatable -- keeps `required` working. */}
      <input
        className="specialtySelectValue"
        type="text"
        name={name}
        value={selected.join("، ")}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />

      {open ? (
        <div className="specialtySelectPanel" role="listbox" aria-multiselectable="true">
          <ul>
            {allOptions.map((option) => {
              const checked = selected.includes(option);
              return (
                <li key={option}>
                  <label className="specialtySelectOption" data-checked={checked}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(option)}
                    />
                    <span className="specialtySelectCheck">
                      {checked ? <Check size={13} /> : null}
                    </span>
                    {option}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="specialtySelectAdd">
            <input
              type="text"
              value={draft}
              placeholder="افزودن مورد جدید…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomOption();
                }
              }}
            />
            <button type="button" onClick={addCustomOption} aria-label="افزودن">
              <Plus size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
