import { Skeleton } from "../_components/Skeleton";

export default function Loading() {
  return (
    <div className="card card--wide" role="status">
      <span className="sr-only">Loading…</span>
      <Skeleton h="bar" w={100} gap="lg" />
      <Skeleton title />
      <Skeleton h="md" />
      <Skeleton h="md" mt />
    </div>
  );
}
