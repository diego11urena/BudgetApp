/** Bespoke to the Transactions layout: title, search/filter bar, then a run of transaction rows (name + amount shape). */
export default function Loading() {
  return (
    <div className="home-page">
      <div className="skeleton-block skeleton-block--title" />
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "2.75rem", marginBottom: "0.75rem" }} />
        <div className="skeleton-block" style={{ height: "1.25rem" }} />
        <div className="skeleton-block" style={{ height: "1.25rem" }} />
        <div className="skeleton-block" style={{ height: "1.25rem" }} />
        <div className="skeleton-block" style={{ height: "1.25rem" }} />
        <div className="skeleton-block" style={{ height: "1.25rem", width: "70%" }} />
      </div>
    </div>
  );
}
