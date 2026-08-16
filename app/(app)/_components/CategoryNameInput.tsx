"use client";

import { useEffect, useRef, useState } from "react";

const TOP_CHIP_COUNT = 6;
const MAX_SUGGESTIONS = 8;

/**
 * A name input with quick-select chips for the top used categories plus a
 * filtered, case-insensitive dropdown of the rest. Selecting a suggestion
 * fills the input with its *exact* stored spelling/casing — the actual fix
 * for the near-miss duplicate problem (typing "rent" when "Rent" already
 * exists used to silently create a second, separate category). A "Create
 * new" option only appears when the typed value doesn't already match an
 * existing category case-insensitively, so creating one is an explicit
 * choice rather than whatever falls out of what you happened to type.
 * getOrCreateCategory (lib/categories.ts) is a second, server-side safety
 * net doing the same case-insensitive match — this UI is guidance, not the
 * only thing standing between a typo and a duplicate category.
 */
export function CategoryNameInput({
  id,
  name,
  categoryNames,
  defaultValue,
  placeholder,
  required = true,
  showChips = true,
  invalid = false,
}: {
  id: string;
  name: string;
  categoryNames: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  /** Set false to render just the text input + dropdown as a single combobox, with no chip row above it. */
  showChips?: boolean;
  /** Applies the shared .is-invalid treatment to the text input — same conditional-class pattern as QuickAddSheet's category input. */
  invalid?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const topCategories = categoryNames.slice(0, TOP_CHIP_COUNT);

  const query = value.trim().toLowerCase();
  const suggestions = (
    query ? categoryNames.filter((c) => c.toLowerCase().includes(query)) : categoryNames
  ).slice(0, MAX_SUGGESTIONS);
  const hasExactMatch = categoryNames.some((c) => c.toLowerCase() === query);
  const showCreateOption = query.length > 0 && !hasExactMatch;

  // Closing on an outside click (not just blur) so a mousedown on a
  // dropdown option — which would otherwise blur the input first — doesn't
  // race the option's own onClick and close the list before the click
  // registers.
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function select(next: string) {
    setValue(next);
    setOpen(false);
  }

  return (
    <div className="category-name-input" ref={containerRef}>
      {showChips && topCategories.length > 0 && (
        <div className="category-chips category-chips--compact">
          {topCategories.map((categoryName) => (
            <button
              key={categoryName}
              type="button"
              className={`category-chip ${value === categoryName ? "is-active" : ""}`}
              onClick={() => select(categoryName)}
            >
              {categoryName}
            </button>
          ))}
        </div>
      )}
      <div className="category-name-input-combobox">
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          className={invalid ? "is-invalid" : ""}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && (suggestions.length > 0 || showCreateOption) && (
          <ul id={`${id}-listbox`} role="listbox" className="category-name-input-dropdown">
            {suggestions.map((categoryName) => (
              <li key={categoryName} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === categoryName}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(categoryName)}
                >
                  {categoryName}
                </button>
              </li>
            ))}
            {showCreateOption && (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="category-name-input-create"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(value.trim())}
                >
                  + Create new: &quot;{value.trim()}&quot;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
