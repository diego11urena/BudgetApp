"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

/**
 * The ⓘ affordance and its bubble (DESIGN.md S6 "Explainer bubble").
 * Onboarding step 2 uses one per group to explain what Scheduled and
 * Ongoing actually mean, which is the distinction the whole recurring
 * model rests on -- so the copy is genuinely load-bearing, not a nicety,
 * and both bubbles open on first view.
 *
 * Disclosure rather than a tooltip: a tooltip is hover-driven and this is
 * a mobile product (DESIGN.md S5). The button carries aria-expanded and
 * controls the bubble by id, so a screen reader gets the same
 * open/closed state a sighted user does.
 */
export default function ExplainerBubble({
  label,
  children,
  defaultOpen = true,
}: {
  /** Accessible name for the ⓘ button, e.g. "What does Scheduled mean?" */
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const bubbleId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="explainer">
      <button
        type="button"
        className={`explainer-toggle${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={bubbleId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <div id={bubbleId} className="explainer-bubble" role="note">
          {children}
        </div>
      )}
    </div>
  );
}
