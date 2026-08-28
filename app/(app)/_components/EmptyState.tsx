import type { ReactNode } from "react";

/**
 * The "nothing here yet" message every list/panel in the app shows on its
 * own -- consolidates ~15 ad hoc `<p className="field-hint">` copies into
 * one place with `role="status"` (a screen reader should announce that a
 * list came back empty, same as it would a loading state) and consistent
 * spacing. `action`, when given, renders as a real inline CTA rather than
 * leaving "tap the + above" as plain unclickable text.
 */
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <p className="field-hint empty-state" role="status">
      {children}
      {action && (
        <>
          {" "}
          <button type="button" className="empty-state-action" onClick={action.onClick}>
            {action.label}
          </button>
        </>
      )}
    </p>
  );
}
