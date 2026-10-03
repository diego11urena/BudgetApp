"use client";

import { useId, useState } from "react";

/**
 * A heading with an ⓘ toggle and the explainer bubble it opens
 * (DESIGN.md S6 "Explainer bubble"). Onboarding step 2 uses one per group
 * to explain what Scheduled and Ongoing actually mean -- the distinction
 * the whole recurring model rests on -- so the copy is load-bearing, not
 * a nicety, and both bubbles open on first view.
 *
 * It owns the heading rather than sitting beside one because the layout
 * is a single unit: the ⓘ sits inline right after the heading text and
 * the bubble spans the full width underneath it, with a caret pointing
 * back up at the ⓘ. Splitting those across two components would leave
 * the caret unable to find the button it points at.
 *
 * Disclosure rather than a tooltip: a tooltip is hover-driven and this is
 * a mobile product (DESIGN.md S5). The button carries aria-expanded and
 * controls the bubble by id, so a screen reader gets the same open/closed
 * state a sighted user does.
 */
export default function ExplainerBubble({
  heading,
  label,
  children,
  defaultOpen = true,
}: {
  heading: string;
  /** Accessible name for the ⓘ button, e.g. "What does Scheduled mean?" */
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const bubbleId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="explainer">
      <div className="explainer-header">
        <h2 className="explainer-heading">{heading}</h2>
        <button
          type="button"
          className={`explainer-toggle${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-controls={bubbleId}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">i</span>
        </button>
      </div>
      {open && (
        <div id={bubbleId} className="explainer-bubble" role="note">
          {children}
        </div>
      )}
    </div>
  );
}
