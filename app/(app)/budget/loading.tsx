/** Bespoke to the Recurring Expenses layout: title, then a few category rows (name + progress bar shape) inside one card. */
export default function Loading() {
  return (
    <div className="home-page">
      <div className="skeleton-block skeleton-block--title" />
      <div className="dashboard-section">
        <div className="skeleton-block" style={{ height: "3.5rem" }} />
        <div className="skeleton-block" style={{ height: "3.5rem" }} />
        <div className="skeleton-block" style={{ height: "3.5rem", width: "85%" }} />
      </div>
    </div>
  );
}
