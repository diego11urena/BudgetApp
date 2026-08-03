"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Standard modal accessibility behavior for the app's sheets/overlays
 * (QuickAddSheet, CycleClosedCard, ConfirmJustGotPaidSheet): traps Tab
 * focus within the container while it's mounted, closes on Escape, moves
 * focus into the container on mount, and returns focus to whatever was
 * focused before it opened (the button that triggered it) on unmount.
 *
 * onClose is read from a ref rather than the effect's dependency array —
 * it's typically a fresh closure every render, and re-running this setup
 * on every render would re-steal focus away from whatever the user is
 * doing inside the modal (typing into the amount field, etc.).
 *
 * returnFocusTo is optional — pass it when the modal has its own
 * autoFocus element (QuickAddSheet's amount field). The caller captures
 * the trigger element itself, synchronously in its onClick, before the
 * modal mounts. Omit it for modals with no internal autoFocus, where
 * document.activeElement at mount time is reliable on its own.
 */
export function useModalFocus(
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  returnFocusTo?: HTMLElement | null,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // React Strict Mode (dev only) synchronously runs mount -> cleanup ->
  // mount once for every effect, specifically to catch effects whose
  // cleanup has an externally-visible side effect that the immediate
  // re-mount would then observe. Ours does, two ways:
  //  1. Restoring focus in cleanup would, on the throwaway first pass, move
  //     focus off the sheet's own autoFocus child before the second, real
  //     mount's "is anything in here already focused?" check runs —
  //     stealing focus from autoFocus to this hook's generic fallback
  //     instead. Deferring the restore to a microtask and only actually
  //     running it if no newer mount has since taken over (a generation
  //     counter) makes the throwaway pass's restore a no-op.
  //  2. When there's no returnFocusTo, capturing "whatever's focused right
  //     now" on the second pass would capture this hook's OWN fallback
  //     focus target from the first pass (since that first pass's restore
  //     hasn't run yet — see #1), not the real trigger element outside.
  //     Captured once, into a ref that survives the double-invoke, so the
  //     second pass reuses the first pass's (correct) answer instead of
  //     re-deriving a corrupted one.
  const generationRef = useRef(0);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const hasCapturedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const myGeneration = ++generationRef.current;
    if (!hasCapturedRef.current) {
      hasCapturedRef.current = true;
      previouslyFocusedRef.current = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    }

    function getFocusable(): HTMLElement[] {
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    // React applies a child's autoFocus during commit, which always
    // completes before any passive effect (including this one) runs — so
    // by now, an autoFocus target has already won if there is one.
    if (!container.contains(document.activeElement)) {
      const focusable = getFocusable();
      (focusable[0] ?? container).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      queueMicrotask(() => {
        // Deliberately reading the *latest* generationRef.current here, not
        // a snapshot — this is the "did a newer mount already take over"
        // check the whole generation-counter exists for.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (generationRef.current === myGeneration) {
          previouslyFocusedRef.current?.focus();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
