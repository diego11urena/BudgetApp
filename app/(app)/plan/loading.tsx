import { Skeleton } from "../../_components/Skeleton";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** Bespoke to the Plan layout (Goals + Bills merged): title, a couple of goal rows (ring + text shape), then a run of bill rows -- same order the real page renders in, so hydrating never visibly swaps the two sections. */
export default async function Loading() {
  const t = getDictionary(await getRequestLocale());

  return (
    <div className="home-page" role="status">
      <span className="sr-only">{t.common.loading}</span>
      <Skeleton title />
      <div className="dashboard-section">
        <Skeleton w={50} gap />
        <Skeleton h="xl" />
        <Skeleton h="xl" w={90} />
      </div>
      <div className="dashboard-section">
        <Skeleton h="lg" />
        <Skeleton h="lg" />
        <Skeleton h="lg" w={85} />
      </div>
    </div>
  );
}
