import { Skeleton } from "../../_components/Skeleton";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** Bespoke to the History layout: title, then a run of past-quincena line items. */
export default async function Loading() {
  const t = getDictionary(await getRequestLocale());
  return (
    <div className="home-page" role="status">
      <span className="sr-only">{t.common.loading}</span>
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
