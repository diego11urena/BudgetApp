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
        <h3>Gmail import</h3>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Connect your Gmail to automatically import purchase notifications from your bank — only
          emails from your bank&apos;s sender address are ever read.
        </p>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Google&apos;s permission screen will show read access to your whole inbox — that&apos;s
          the scope Google requires for this kind of import, not something Balboa asks for beyond
          it. Balboa&apos;s own code only ever looks at messages from your bank.
        </p>
        <a href="/api/gmail/connect" className="button button--secondary">
          Connect Gmail
        </a>
      </div>
    );
  }

  return (
    <div>
      <h3>Gmail import</h3>
      <p className="field-hint">Connected as {connection.googleEmail}</p>
      <p className="field-hint" style={{ marginTop: "0.25rem" }}>
        {connection.lastSyncedAt
          ? `Last synced: ${connection.lastSyncedAt.toLocaleString()}`
          : "Not synced yet"}
      </p>
      {connection.lastSyncError && (
        <p className="error-text" style={{ marginTop: "0.25rem" }}>
          {connection.lastSyncError}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        {connection.lastSyncError && (
          // Re-hitting /connect for an already-connected account re-runs the
          // OAuth flow and updates this same connection (the callback route's
          // upsert `update` branch) rather than creating a duplicate one --
          // this is the actual "reconnect" the error text above refers to.
          // Previously there was no way to do this without disconnecting
          // first, even though the error message told users to reconnect.
          <a href="/api/gmail/connect" className="button button--secondary button--small">
            Reconnect Gmail
          </a>
        )}
        <form action={disconnectGmailAction}>
          <button type="submit" className="button button--secondary button--small">
            Disconnect
          </button>
        </form>
      </div>
    </div>
  );
}
