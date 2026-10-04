"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "../../components/ui";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ProfileSheet } from "../profile/ProfileSheet";
import { toPersianDigits } from "../../shared/lib/digits";

/**
 * Multi-select "specialty/service" picker for the salon/artist signup and
 * profile forms. The field itself is a compact trigger showing the chosen
 * values as chips; tapping it opens a bottom sheet with a searchable grid of
 * icon tiles, so the form never grows into a long inline list.
 *
 * It still writes one comma-joined text value (same `service` column as every
 * other form field) through a plain text input kept off-screen (not
 * type="hidden" -- hidden inputs skip HTML5 constraint validation, and
 * `required` needs to keep working here).
 */
export function SpecialtyMultiSelect({ name, placeholder, options, required, defaultValue = "" }) {
  const initial = String(defaultValue || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initial);
  // Previously saved values that aren't in the preset list stay selectable.
  const [extraOptions, setExtraOptions] = useState(() => initial.filter((item) => !options.includes(item)));
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const allOptions = useMemo(() => [...options, ...extraOptions], [options, extraOptions]);
  const visible = useMemo(() => {
    const q = query.trim();
    return q ? allOptions.filter((option) => option.includes(q)) : allOptions;
  }, [allOptions, query]);

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
    setQuery("");
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="specialtySelect" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="specialtySelectTrigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {selected.length ? (
          <span className="specialtySelectChips">
            {selected.map((item) => <em key={item}>{item}</em>)}
          </span>
        ) : (
          <span className="is-placeholder">{placeholder}</span>
        )}
        {selected.length ? <b className="specialtySelectCount">{toPersianDigits(selected.length)}</b> : null}
        <ChevronDown size={16} className="specialtySelectChevron" />
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

      <ProfileSheet
        open={open}
        kicker="انتخاب چندتایی"
        title="حوزه فعالیت"
        panelClassName="specialtySheet"
        onClose={close}
      >
        <label className="specialtySheetSearch">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو… (مثلاً ناخن، لیزر)"
            aria-label="جستجوی حوزه فعالیت"
          />
        </label>

        <div className="specialtySheetGrid" role="listbox" aria-multiselectable="true">
          {visible.map((option) => {
            const checked = selected.includes(option);
            return (
              <button
                type="button"
                key={option}
                role="option"
                aria-selected={checked}
                className="specialtyTile"
                data-checked={checked}
                onClick={() => toggleOption(option)}
              >
                <ServiceIcon name={option} size="sm" />
                <span>{option}</span>
                {checked ? <i className="specialtyTileCheck"><Check size={12} aria-hidden="true" /></i> : null}
              </button>
            );
          })}
          {visible.length === 0 ? (
            <p className="specialtySheetEmpty">موردی پیدا نشد؛ می‌توانی پایین خودت اضافه‌اش کنی.</p>
          ) : null}
        </div>

        <div className="specialtySheetAdd">
          <input
            type="text"
            value={draft}
            placeholder="مورد دلخواه خودت را اضافه کن…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomOption();
              }
            }}
          />
          <button type="button" onClick={addCustomOption} aria-label="افزودن" disabled={!draft.trim()}>
            <Plus size={16} />
          </button>
        </div>

        <div className="specialtySheetBar">
          <Button block icon={Check} className="specialtySheetDone" onClick={close}>
            {selected.length ? `تأیید (${toPersianDigits(selected.length)} مورد)` : "بستن"}
          </Button>
        </div>
      </ProfileSheet>
    </div>
  );
}
