"use client";

import { useEffect, useId, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useModalFocus } from "./useModalFocus";

const DEFAULT_TITLE_STYLE: CSSProperties = { marginBottom: "1rem" };
const DRAG_DISMISS_PX = 80;

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
   * a sheet with no natural single-line title (e.g. QuickAddSheet, whose
   * segmented type toggle is the real header) -- `ariaLabel` is required
   * in that case instead.
   */
  title?: ReactNode;
  /** Uppercase kicker above the title -- the design system's sheet header pattern ("PAYCHECK 2 OF 2", "SEP 1 - SEP 30 · DAY 13 OF 30"). */
  kicker?: ReactNode;
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
  kicker,
  titleStyle,
  ariaLabel,
  onClose,
  closeOnBackdropClick = true,
  returnFocusTo = null,
  autoFocus = true,
  className = "",
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const headingId = useId();

  useModalFocus(panelRef, onClose, returnFocusTo, autoFocus);

  // A drag-dismiss leaves the panel parked off-screen via inline style; clear
  // it when a sheet that hides without unmounting (CategoryFormSheet) reopens.
  useEffect(() => {
    if (visible && panelRef.current) panelRef.current.style.transform = "";
  }, [visible]);

  // Keyboard-aware: size the backdrop to the visual viewport, which shrinks
  // when the on-screen keyboard opens, so the bottom-anchored panel (and its
  // max-height) sit above the keyboard instead of behind it.
  useEffect(() => {
    const vv = window.visualViewport;
    const backdrop = backdropRef.current;
    if (!vv || !backdrop) return;
    function fit() {
      backdrop!.style.top = `${vv!.offsetTop}px`;
      backdrop!.style.height = `${vv!.height}px`;
    }
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);

  // Drag the handle down to dismiss. Pointer events cover touch and mouse;
  // pointer capture keeps the drag alive once the finger leaves the handle.
  // Respects closeOnBackdropClick, so a sheet mid-submit can't be flung away.
  const dragHandlers = closeOnBackdropClick
    ? {
        onPointerDown(e: PointerEvent<HTMLDivElement>) {
          dragStartY.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
          panelRef.current!.style.transition = "none";
        },
        onPointerMove(e: PointerEvent<HTMLDivElement>) {
          if (dragStartY.current === null) return;
          const delta = Math.max(0, e.clientY - dragStartY.current);
          panelRef.current!.style.transform = `translateY(${delta}px)`;
        },
        onPointerUp(e: PointerEvent<HTMLDivElement>) {
          if (dragStartY.current === null) return;
          const panel = panelRef.current!;
          const dismiss = e.clientY - dragStartY.current > DRAG_DISMISS_PX;
          dragStartY.current = null;
          panel.style.transition = "";
          // Slide out from where the finger let go instead of snapping back first.
          panel.style.transform = dismiss ? "translateY(100%)" : "";
          if (dismiss) onClose();
        },
      }
    : {};

  return (
    <div
      ref={backdropRef}
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
        <div className="sheet-handle-area" {...dragHandlers} onPointerCancel={dragHandlers.onPointerUp}>
          <div className="sheet-handle" />
        </div>
        {kicker && <p className="sheet-kicker">{kicker}</p>}
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
