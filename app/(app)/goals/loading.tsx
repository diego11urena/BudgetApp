import { Skeleton } from "../../_components/Skeleton";

/** Bespoke to the Goals layout: title, section header, then a couple of goal rows (ring + text shape). */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton title />
      <div className="dashboard-section">
        <Skeleton w={50} gap />
        <Skeleton h="xl" />
        <Skeleton h="xl" w={90} />
      </div>
    </div>
  );
}
