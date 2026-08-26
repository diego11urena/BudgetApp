/** Bespoke to the History layout: title, then a run of past-quincena line items. */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <div className="skeleton-block skeleton-block--title" />
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "1.75rem" }} />
        <div className="skeleton-block" style={{ height: "1.75rem" }} />
        <div className="skeleton-block" style={{ height: "1.75rem" }} />
        <div className="skeleton-block" style={{ height: "1.75rem", width: "75%" }} />
      </div>
    </div>
  );
}
