import { Skeleton } from "../../_components/Skeleton";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/**
 * Bespoke to this route's real layout (Insights card, balance card, budget
 * breakdown, top-categories chart, recent transactions) rather than the
 * shared (app)/loading.tsx generic fallback -- Next.js prefers this file
 * for /dashboard specifically. See (app)/loading.tsx for why a skeleton
 * exists here at all (fast Postgres queries, still worth a flash of
 * layout-matching structure over a blank screen).
 */
export default async function Loading() {
  const t = getDictionary(await getRequestLocale());
  return (
    <div className="home-page" role="status">
      <span className="sr-only">{t.common.loading}</span>
      <Skeleton title />

      <div className="dashboard-section dashboard-section--plain">
        <Skeleton h="xl" />
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <Skeleton h="3xl" />
      </div>

      <div className="dashboard-section">
        <Skeleton h="xl2" />
      </div>

      <div className="dashboard-section">
        <Skeleton h="2xl" />
      </div>

      <div className="dashboard-section">
        <Skeleton w={40} gap />
        <Skeleton h="md" />
        <Skeleton h="md" />
        <Skeleton h="md" w={80} />
      </div>
    </div>
  );
}
