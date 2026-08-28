import { Skeleton } from "../../_components/Skeleton";

/** Bespoke to the History layout: title, then a run of past-quincena line items. */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton title />
      <div className="dashboard-section">
        <Skeleton h="sm" />
        <Skeleton h="sm" />
        <Skeleton h="sm" />
        <Skeleton h="sm" w={75} />
      </div>
    </div>
  );
}
