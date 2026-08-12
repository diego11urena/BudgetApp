"use client";

import { useRef, useState } from "react";

const TOP_CHIP_COUNT = 6;

/**
 * A name input with quick-select chips for the top used categories plus a
 * native <datalist> covering the rest — the full picker. `categoryNames` is
 * expected pre-ordered (most-used-this-cycle, then recently-used, then
 * alphabetical; see lib/category-order.ts) so the chips and the datalist's
 * suggestion order both reflect that. Category creation elsewhere upserts
 * by exact-name match, so a near-miss (extra space, different case) would
 * silently create a second, separate category — the chips and autocomplete
 * both nudge reuse of the exact existing name.
 */
export function CategoryNameInput({
  id,
  name,
  categoryNames,
  defaultValue,
  placeholder,
  required = true,
  showChips = true,
}: {
  id: string;
  name: string;
  categoryNames: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  /** Set false to render just the text input + native datalist as a single combobox, with no chip row above it. */
  showChips?: boolean;
}) {
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeValue, setActiveValue] = useState(defaultValue ?? "");
  const topCategories = categoryNames.slice(0, TOP_CHIP_COUNT);

  function selectChip(value: string) {
    setActiveValue(value);
    if (inputRef.current) inputRef.current.value = value;
  }

  return (
    <>
      {showChips && topCategories.length > 0 && (
        <div className="category-chips category-chips--compact">
          {topCategories.map((categoryName) => (
            <button
              key={categoryName}
              type="button"
              className={`category-chip ${activeValue === categoryName ? "is-active" : ""}`}
              onClick={() => selectChip(categoryName)}
            >
              {categoryName}
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        list={listId}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onChange={(e) => setActiveValue(e.target.value)}
      />
      <datalist id={listId}>
        {categoryNames.map((categoryName) => (
          <option key={categoryName} value={categoryName} />
        ))}
      </datalist>
    </>
  );
}
