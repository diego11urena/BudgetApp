"use client";

import { Sheet } from "./Sheet";
import { useSheetVisibility } from "./useSheet";

export interface ActionSheetOption {
  label: string;
  /** Red, for the option that deletes something. */
  destructive?: boolean;
  onSelect: () => void;
}

/**
 * The iOS action sheet: a short title, a stack of choices and a separate
 * Cancel, sliding up from the bottom like every other sheet here.
 */
export function ActionSheet({
  title,
  message,
  options,
  cancelLabel,
  onCancel,
}: {
  title: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel: string;
  onCancel: () => void;
}) {
  const { visible, closeThen } = useSheetVisibility();
  return (
    <Sheet visible={visible} title={title} onClose={() => closeThen(onCancel)}>
      {message && <p className="action-sheet-message">{message}</p>}
      <div className="action-sheet-options">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`action-sheet-option${option.destructive ? " action-sheet-option--destructive" : ""}`}
            onClick={() => closeThen(option.onSelect)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button type="button" className="button button--ghost sheet-submit" onClick={() => closeThen(onCancel)}>
        {cancelLabel}
      </button>
    </Sheet>
  );
}
