import { disconnectGmailAction } from "../gmail-actions";

export interface GmailConnectionInfo {
  googleEmail: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
}

export function GmailConnectionCard({ connection }: { connection: GmailConnectionInfo | null }) {
  if (!connection) {
    return (
      <div>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Connect your Gmail to automatically import purchase notifications from your bank — only
          emails from your bank&apos;s sender address are ever read.
        </p>
        <a href="/api/gmail/connect" className="button button--secondary">
          Connect Gmail
        </a>
      </div>
    );
  }

  return (
    <div>
      <p className="field-hint">Connected as {connection.googleEmail}</p>
      <p className="field-hint" style={{ marginTop: "0.25rem" }}>
        {connection.lastSyncedAt
          ? `Last synced: ${connection.lastSyncedAt.toLocaleString()}`
          : "Not synced yet"}
      </p>
      {connection.lastSyncError && (
        <p className="error-text" style={{ marginTop: "0.25rem" }}>
          Last sync failed — try reconnecting.
        </p>
      )}
      <form action={disconnectGmailAction} style={{ marginTop: "0.5rem" }}>
        <button type="submit" className="button button--secondary button--small">
          Disconnect
        </button>
      </form>
    </div>
  );
}
