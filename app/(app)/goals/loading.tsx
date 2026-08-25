/** Bespoke to the Goals layout: title, section header, then a couple of goal rows (ring + text shape). */
export default function Loading() {
  return (
    <div className="home-page">
      <div className="skeleton-block skeleton-block--title" />
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ width: "50%", marginBottom: "0.75rem" }} />
        <div className="skeleton-block" style={{ height: "4.5rem" }} />
        <div className="skeleton-block" style={{ height: "4.5rem", width: "90%" }} />
      </div>
    </div>
  );
}
