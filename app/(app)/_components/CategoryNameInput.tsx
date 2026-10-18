"use client";

import { useState } from "react";
import { useT } from "@/app/_components/LocaleProvider";

const NEW = "__new__";

/**
 * A native <select> over the user's existing categories (iOS shows its own
 * wheel picker, no keyboard) plus a "+ New category…" option that reveals a
 * text field -- the same pattern QuickAddSheet's category field uses.
 * Picking from the list submits the category's *exact* stored spelling, so
 * typing "rent" when "Rent" exists can't silently create a second category;
 * getOrCreateCategory (lib/categories.ts) is the server-side safety net
 * doing the same case-insensitive match. With no existing categories
 * there's nothing to pick, so it's just the text field.
 */
export function CategoryNameInput({
  id,
  name,
  categoryNames,
  defaultValue,
  placeholder,
  required = true,
  invalid = false,
  describedBy,
  onValueChange,
}: {
  id: string;
  name: string;
  categoryNames: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  /** Applies the shared .is-invalid treatment -- same conditional-class pattern as QuickAddSheet's category field. */
  invalid?: boolean;
  /** id of the caller's error message, when invalid -- wired to aria-describedby. */
  describedBy?: string;
  /** For callers that derive something live from the current value (e.g. GoalStepForm), not just read it at submit. */
  onValueChange?: (value: string) => void;
}) {
  const t = useT();
  const initial = defaultValue ?? "";
  const match = categoryNames.find((c) => c.toLowerCase() === initial.trim().toLowerCase());
  const [choice, setChoice] = useState(match ?? (initial && categoryNames.length > 0 ? NEW : ""));
  const [newName, setNewName] = useState(match ? "" : initial);
  // Only when the user picks "+ New category…" -- not when a sheet opens pre-set to a custom name.
  const [focusNew, setFocusNew] = useState(false);
  const creating = categoryNames.length === 0 || choice === NEW;
  const a11y = {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? describedBy : undefined,
    className: invalid ? "is-invalid" : "",
  };

  const textInput = (
    <input
      id={categoryNames.length === 0 ? id : undefined}
      name={name}
      type="text"
      value={newName}
      placeholder={categoryNames.length === 0 ? placeholder : t.quickAdd.newCategoryPlaceholder}
      aria-label={categoryNames.length === 0 ? undefined : t.quickAdd.newCategoryPlaceholder}
      required={required}
      autoComplete="off"
      autoFocus={focusNew}
      {...a11y}
      onChange={(e) => {
        setNewName(e.target.value);
        onValueChange?.(e.target.value);
      }}
    />
  );
  if (categoryNames.length === 0) return textInput;

  return (
    <>
      <select
        id={id}
        value={choice}
        required={required && !creating}
        {...(creating ? {} : a11y)}
        onChange={(e) => {
          setChoice(e.target.value);
          setFocusNew(e.target.value === NEW);
          onValueChange?.(e.target.value === NEW ? newName : e.target.value);
        }}
      >
        <option value="" disabled={required}>
          {t.quickAdd.chooseCategoryOption}
        </option>
        {categoryNames.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW}>{t.quickAdd.newCategoryOption}</option>
      </select>
      {creating ? textInput : <input type="hidden" name={name} value={choice} />}
    </>
  );
}
