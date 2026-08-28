import { Skeleton } from "../_components/Skeleton";

/**
 * The shared (app) layout's own fallback — shown while its own data
 * fetch (categories for BottomNav, etc.) is in flight, and for any route
 * segment under (app) that doesn't define its own bespoke loading.tsx
 * (dashboard/budget/transactions/goals/history/profile all do — see
 * those files — since each one's real layout is different enough to be
 * worth matching). Generic on purpose here: this one has no single page
 * shape to match. Real Postgres queries are fast enough that any of these
 * skeletons rarely show for more than a flash.
 */
export default function Loading() {
  return (
    <div className="home-page" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton title />
      <div className="dashboard-section dashboard-section--plain">
        <Skeleton h="2xl" />
      </div>
      <div className="dashboard-section">
        <Skeleton />
        <Skeleton w={70} />
      </div>
      <div className="dashboard-section">
        <Skeleton />
        <Skeleton w={55} />
      </div>
    </div>
  );
}
