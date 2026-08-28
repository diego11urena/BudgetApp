import { Skeleton } from "../../_components/Skeleton";

/** Bespoke to the Plan layout (Bills + Goals merged): title, a run of bill rows, then a couple of goal rows (ring + text shape). */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton title />
      <div className="dashboard-section">
        <Skeleton h="lg" />
        <Skeleton h="lg" />
        <Skeleton h="lg" w={85} />
      </div>
      <div className="dashboard-section">
        <Skeleton w={50} gap />
        <Skeleton h="xl" />
        <Skeleton h="xl" w={90} />
      </div>
    </div>
  );
}
