import { Skeleton } from "../../_components/Skeleton";

/** Bespoke to the Profile layout: title, then several distinct settings sections (name/email, password, income, Gmail, links). */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton title />
      <div className="dashboard-section">
        <Skeleton h="xs" w={40} />
      </div>
      <div className="dashboard-section">
        <Skeleton h="md" />
      </div>
      <div className="dashboard-section">
        <Skeleton h="md" />
      </div>
      <div className="dashboard-section">
        <Skeleton h="md" />
      </div>
      <div className="dashboard-section">
        <Skeleton h="sm" w={60} />
      </div>
    </div>
  );
}
