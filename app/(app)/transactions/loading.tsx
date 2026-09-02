import { Skeleton } from "../../_components/Skeleton";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** Bespoke to the Transactions layout: title, search/filter bar, then a run of transaction rows (name + amount shape). */
export default async function Loading() {
  const t = getDictionary(await getRequestLocale());

  return (
    <div className="home-page" role="status">
      <span className="sr-only">{t.common.loading}</span>
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
