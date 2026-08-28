import { Skeleton } from "../../_components/Skeleton";

/** Bespoke to the Transactions layout: title, search/filter bar, then a run of transaction rows (name + amount shape). */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton title />
      <div className="dashboard-section">
        <Skeleton h="md" gap />
        <Skeleton h="xs" />
        <Skeleton h="xs" />
        <Skeleton h="xs" />
        <Skeleton h="xs" />
        <Skeleton h="xs" w={70} />
      </div>
    </div>
  );
}
