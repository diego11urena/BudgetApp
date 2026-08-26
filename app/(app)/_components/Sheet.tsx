"use client";

import { useId, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { useModalFocus } from "./useModalFocus";

const DEFAULT_TITLE_STYLE: CSSProperties = { textAlign: "center", marginBottom: "1rem" };

export interface SheetProps {
  /**
   * Controls the enter/exit slide animation -- true while the sheet should
   * be shown. The caller still owns this (and the ~200ms delay before
   * actually unmounting/calling its own onDone), matching every sheet's
   * own pre-existing local `visible` state -- Sheet is a presentational
   * wrapper, not an animation-state owner, so a sheet that needs to hide
   * itself without unmounting (CategoryFormSheet while its stacked
   * IconPickerSheet is open) can just pass `visible={false}` without
   * losing its place.
   */
  visible: boolean;
  /**
   * Rendered as the dialog's own visible <h2>, and wired via
   * aria-labelledby so the accessible name always matches what's on
   * screen instead of a hand-kept-in-sync separate string. Omit only for
   * a sheet with no natural single-line title (e.g. AddActionSheet's
   * action grid) -- `ariaLabel` is required in that case instead.
   */
  title?: ReactNode;
  /** Overrides the title <h2>'s default centered/1rem-below spacing -- a few sheets use a tighter margin above body copy that immediately follows the heading. */
  titleStyle?: CSSProperties;
  /** The dialog's accessible name when there's no `title` to point aria-labelledby at. Ignored (aria-labelledby wins) when `title` is set. */
  ariaLabel?: string;
  /** Starts the close animation — same contract every sheet's own handleClose already had: called on backdrop click, Escape, or any control inside. */
  onClose: () => void;
  /** False disables backdrop-click-to-dismiss (e.g. while a submit is pending, or while a stacked child sheet is open) -- Escape and any button inside still call onClose directly. */
  closeOnBackdropClick?: boolean;
  returnFocusTo?: HTMLElement | null;
  /** Passed straight through to useModalFocus -- false for a sheet that should appear passively, with nothing grabbing the keyboard until the user taps a field (NeedsAttentionSheet). */
  autoFocus?: boolean;
  /** Extra class(es) appended after "sheet" on the dialog panel (e.g. IconPickerSheet's own "icon-picker-sheet" modifier). */
  className?: string;
  /** Only needed by a sheet that reads/writes its own panel's DOM directly (QuickAddSheet's swipe-to-dismiss drag handlers) -- every other sheet lets Sheet own its ref internally. */
  panelRef?: RefObject<HTMLDivElement | null>;
  /** Overrides the plain handle div's own props (QuickAddSheet's swipe-to-dismiss touch handlers) -- omit for the ordinary static handle. */
  handleProps?: HTMLAttributes<HTMLDivElement>;
  children: ReactNode;
}

/**
 * The bottom-sheet scaffold every modal in this app renders — backdrop,
 * sliding panel, drag handle, and the role="dialog"/aria-modal/focus-trap/
 * scroll-lock wiring (via useModalFocus, untouched) — extracted from ~21
 * near-identical copies. The one behavioral change this makes everywhere
 * at once: every sheet now points aria-labelledby at its own visible
 * <h2> instead of carrying a separate, hand-kept-in-sync aria-label
 * string (some of which had already drifted from their own heading text).
 */
export function Sheet({
  visible,
  title,
  titleStyle,
  ariaLabel,
  onClose,
  closeOnBackdropClick = true,
  returnFocusTo = null,
  autoFocus = true,
  className = "",
  panelRef: externalRef,
  handleProps,
  children,
}: SheetProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const panelRef = externalRef ?? internalRef;
  const headingId = useId();

  useModalFocus(panelRef, onClose, returnFocusTo, autoFocus);

  return (
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        aria-label={title ? undefined : ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" {...handleProps} />
        {title && (
          <h2 id={headingId} style={titleStyle ?? DEFAULT_TITLE_STYLE}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
