import { disconnectGmailAction } from "../gmail-actions";
import { useT } from "../../../_components/LocaleProvider";

export interface GmailConnectionInfo {
  googleEmail: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
}

export function GmailConnectionCard({ connection }: { connection: GmailConnectionInfo | null }) {
  const t = useT();

  if (!connection) {
    return (
      <div>
        <h3>{t.profile.gmail.title}</h3>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          {t.profile.gmail.body}
        </p>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          {t.profile.gmail.scopeNote}
        </p>
        <a href="/api/gmail/connect" className="button button--secondary">
          {t.profile.gmail.connect}
        </a>
      </div>
    );
  }

  return (
    <div>
      <h3>{t.profile.gmail.title}</h3>
      <p className="field-hint">{t.profile.gmail.connectedAs(connection.googleEmail)}</p>
      <p className="field-hint" style={{ marginTop: "0.25rem" }}>
        {connection.lastSyncedAt
          ? t.profile.gmail.lastSynced(connection.lastSyncedAt.toLocaleString())
          : t.profile.gmail.notSynced}
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
            {t.profile.gmail.reconnect}
          </a>
        )}
        <form action={disconnectGmailAction}>
          <button type="submit" className="button button--secondary button--small">
            {t.profile.gmail.disconnect}
          </button>
        </form>
      </div>
    </div>
  );
}
