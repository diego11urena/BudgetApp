export default function Loading() {
  return (
    <div className="card card--wide">
      <div className="skeleton-block" style={{ height: "4px", width: "100%", marginBottom: "1.5rem" }} />
      <div className="skeleton-block skeleton-block--title" />
      <div className="skeleton-block" style={{ height: "2.5rem" }} />
      <div className="skeleton-block" style={{ height: "2.5rem", marginTop: "1rem" }} />
    </div>
  );
}
