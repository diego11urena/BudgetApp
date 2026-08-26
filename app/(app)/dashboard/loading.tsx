/**
 * Bespoke to this route's real layout (Insights card, balance card, budget
 * breakdown, top-categories chart, recent transactions) rather than the
 * shared (app)/loading.tsx generic fallback -- Next.js prefers this file
 * for /dashboard specifically. See (app)/loading.tsx for why a skeleton
 * exists here at all (fast Postgres queries, still worth a flash of
 * layout-matching structure over a blank screen).
 */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <div className="skeleton-block skeleton-block--title" />

      <div className="dashboard-section dashboard-section--plain">
        <div className="skeleton-block" style={{ height: "4.5rem" }} />
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <div className="skeleton-block" style={{ height: "9rem" }} />
      </div>

      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "5rem" }} />
      </div>

      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "6rem" }} />
      </div>

      <div className="dashboard-section">
        <div className="skeleton-block" style={{ width: "40%", marginBottom: "0.75rem" }} />
        <div className="skeleton-block" style={{ height: "2.5rem" }} />
        <div className="skeleton-block" style={{ height: "2.5rem" }} />
        <div className="skeleton-block" style={{ height: "2.5rem", width: "80%" }} />
      </div>
    </div>
  );
}
