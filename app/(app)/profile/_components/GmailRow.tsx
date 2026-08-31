"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet } from "../../_components/Sheet";
import { useSheet } from "../../_components/useSheet";
import { GmailConnectionCard, type GmailConnectionInfo } from "./GmailConnectionCard";

/**
 * Gmail's own full connect/reconnect/disconnect panel (GmailConnectionCard,
 * untouched) used to sit permanently expanded in the "Your data" card --
 * now behind this single summary row, matching the design system's "one
 * row per settings item" pattern (Change password, Manage categories).
 */
export function GmailRow({ connection }: { connection: GmailConnectionInfo | null }) {
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className="line-item line-item--link profile-gmail-row" {...triggerProps}>
        <span>
          <span className="line-item-title">Gmail import</span>
          {connection && (
            <span className="field-hint">
              {connection.lastSyncedAt
                ? `Synced ${connection.lastSyncedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · ${connection.googleEmail}`
                : connection.googleEmail}
            </span>
          )}
        </span>
        {connection ? (
          <span className="profile-gmail-status">
            <span className="profile-gmail-status-dot" aria-hidden="true" /> On
          </span>
        ) : (
          <ChevronRight size={18} aria-hidden="true" />
        )}
      </button>

      {open && <GmailSheetContent connection={connection} {...sheetProps} onClose={close} />}
    </>
  );
}

function GmailSheetContent({
  connection,
  returnFocusTo,
  onClose,
}: {
  connection: GmailConnectionInfo | null;
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <Sheet visible={visible} title="Gmail import" onClose={handleClose} returnFocusTo={returnFocusTo}>
      <GmailConnectionCard connection={connection} />
    </Sheet>
  );
}
