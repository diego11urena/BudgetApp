/**
 * Shown while any (app) route's server component is fetching data —
 * replaces Next.js's blank default with something in the app's own visual
 * language instead. Deliberately generic (not a bespoke skeleton per tab)
 * since real Postgres queries here are fast enough that this rarely shows
 * for more than a flash.
 */
export default function Loading() {
  return (
    <div className="home-page">
      <div className="skeleton-block skeleton-block--title" />
      <div className="dashboard-section dashboard-section--plain">
        <div className="skeleton-block" style={{ height: "6rem" }} />
      </div>
      <div className="dashboard-section">
        <div className="skeleton-block" />
        <div className="skeleton-block" style={{ width: "70%" }} />
      </div>
      <div className="dashboard-section">
        <div className="skeleton-block" />
        <div className="skeleton-block" style={{ width: "55%" }} />
      </div>
    </div>
  );
}
