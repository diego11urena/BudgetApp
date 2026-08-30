"use client";

import { useState } from "react";
import { centsToDecimalString, centsToDisplay, decimalStringToCents, digitsFromRawInput } from "@/lib/currency-input";

/**
 * An implicit-decimal money input: the user only ever types digits (the
 * numeric-only virtual keyboard, no . or , key needed) and every keystroke
 * appends to an integer number of cents -- typing "125050" produces
 * "1,250.50", exactly like a POS terminal's amount tender field. Backspace
 * removes the last digit the same way ("1,250.50" -> "125.05" -> ...).
 * There's deliberately no cursor-position handling: this widget's whole
 * model is "always append/remove at the end," enforced by selecting the
 * full value on focus and re-pinning the caret to the end synchronously
 * inside handleChange (so tapping anywhere in the field still behaves the
 * same as tapping at the end) -- done imperatively on the DOM node itself,
 * in the same tick as the input event, rather than in an effect: an effect
 * only runs after React's next render commits, and a fast typist (or an
 * automated one -- Playwright's pressSequentially can fire the next
 * keydown well inside that gap) can get their next keystroke in before
 * the caret's been corrected, landing it mid-string instead of at the end.
 *
 * Self-managed like CategoryNameInput (defaultValue + onValueChange, not a
 * value/onChange controlled component): none of this app's money fields
 * need to reset an already-mounted instance's value from outside, and every
 * sheet that holds one already remounts fresh (via key or by being
 * conditionally rendered) whenever it needs a different starting amount.
 *
 * The visible input never carries a `name` -- its own DOM value has commas
 * a decimal point for display, which would corrupt a plain `Number(...)`
 * parse if submitted as-is. When `name` is given, a hidden mirror input
 * carries the clean "1234.56" string instead, so both native
 * `<form action={serverAction}>` submission and `new FormData(formEl)`
 * reads get the same string this app's server actions/schemas already
 * expect -- no server-side changes needed anywhere this replaces a plain
 * text input.
 */
export function CurrencyInput({
  id,
  name,
  defaultValue = "0.00",
  allowEmpty = false,
  onValueChange,
  placeholder,
  autoFocus = false,
  required = false,
  className,
  invalid = false,
  describedBy,
}: {
  id?: string;
  /** When set, a hidden input with this name mirrors the clean decimal value for form submission. */
  name?: string;
  /** A decimal string like "45.50", matching this app's existing amount representation. Parsed once at mount. */
  defaultValue?: string;
  /** Set true for a genuinely optional amount (e.g. an unset per-cycle goal contribution) where blank must stay distinct from "$0.00" -- decimalString's own server-side schema rejects an explicit 0 for these fields. Blank starts empty (placeholder shows through) instead of at "0.00", and backspacing below one digit returns to blank rather than floor at "0.00". */
  allowEmpty?: boolean;
  /** Called with the clean "1234.56" decimal string on every change ("" when allowEmpty and currently blank). */
  onValueChange?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Applied to the hidden mirror input only -- native `required` can't be enforced on a hidden field by the browser, and the visible field is never truly empty in non-allowEmpty mode anyway (it floors at "0.00"). Kept for the handful of plain useActionState forms this replaces, where it's at least documentation of intent even though enforcement now happens server-side. */
  required?: boolean;
  className?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [cents, setCents] = useState<number | null>(() => {
    if (!defaultValue || !defaultValue.trim()) return allowEmpty ? null : 0;
    return decimalStringToCents(defaultValue);
  });

  const display = cents === null ? "" : centsToDisplay(cents);
  const decimalValue = cents === null ? "" : centsToDecimalString(cents);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = digitsFromRawInput(e.target.value);
    const newCents = digits === "" ? (allowEmpty ? null : 0) : Number(digits);
    const newDisplay = newCents === null ? "" : centsToDisplay(newCents);
    // Imperative, synchronous DOM write -- see the component doc comment
    // above for why this can't wait for React's own re-render.
    e.target.value = newDisplay;
    e.target.setSelectionRange(newDisplay.length, newDisplay.length);
    setCents(newCents);
    onValueChange?.(newCents === null ? "" : centsToDecimalString(newCents));
  }

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      {name && <input type="hidden" name={name} value={decimalValue} required={required} />}
    </>
  );
}
