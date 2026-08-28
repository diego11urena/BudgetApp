import { Skeleton } from "../../_components/Skeleton";

/** Bespoke to the Recurring Expenses layout: title, then a few category rows (name + progress bar shape) inside one card. */
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
    </div>
  );
}
