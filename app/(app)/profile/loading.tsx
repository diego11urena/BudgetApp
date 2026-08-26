/** Bespoke to the Profile layout: title, then several distinct settings sections (name/email, password, income, Gmail, links). */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <div className="skeleton-block skeleton-block--title" />
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "1.25rem", width: "40%" }} />
      </div>
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "2.5rem" }} />
      </div>
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "2.5rem" }} />
      </div>
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "2.5rem" }} />
      </div>
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "1.5rem", width: "60%" }} />
      </div>
    </div>
  );
}
