"use client";

import { ChevronRight } from "lucide-react";
import { Sheet } from "../../_components/Sheet";
import { useSheet, useSheetVisibility } from "../../_components/useSheet";
import { GmailConnectionCard, type GmailConnectionInfo } from "./GmailConnectionCard";
import { useT, useLocale } from "../../../_components/LocaleProvider";

/**
 * Gmail's own full connect/reconnect/disconnect panel (GmailConnectionCard,
 * untouched) used to sit permanently expanded in the "Your data" card --
 * now behind this single summary row, matching the design system's "one
 * row per settings item" pattern (Change password, Manage categories).
 */
export function GmailRow({ connection }: { connection: GmailConnectionInfo | null }) {
  const { open, triggerProps, sheetProps, close } = useSheet();
  const t = useT();
  const locale = useLocale();

  return (
    <>
      <button type="button" className="line-item line-item--link profile-gmail-row" {...triggerProps}>
        <span>
          <span className="line-item-title">{t.profile.gmail.title}</span>
          {connection && (
            <span className="field-hint">
              {connection.lastSyncedAt
                ? t.profile.gmail.synced(
                    connection.lastSyncedAt.toLocaleTimeString(locale === "es" ? "es-PA" : "en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    }),
                    connection.googleEmail,
                  )
                : connection.googleEmail}
            </span>
          )}
        </span>
        <span className="profile-row-trailing">
          {connection && (
            <span className={`profile-gmail-status ${connection.lastSyncError ? "profile-gmail-status--error" : ""}`}>
              <span className="profile-gmail-status-dot" aria-hidden="true" />
              {connection.lastSyncError ? t.profile.gmail.error : t.profile.gmail.on}
            </span>
          )}
          <ChevronRight size={18} aria-hidden="true" />
        </span>
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
  const { visible, closeThen } = useSheetVisibility();
  const t = useT();

  function handleClose() {
    closeThen(onClose);
  }

  return (
    <Sheet visible={visible} title={t.profile.gmail.title} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <GmailConnectionCard connection={connection} />
    </Sheet>
  );
}
