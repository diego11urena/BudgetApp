import { Skeleton } from "../_components/Skeleton";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function Loading() {
  const t = getDictionary(await getRequestLocale());
  return (
    <div className="card card--wide" role="status">
      <span className="sr-only">{t.common.loading}</span>
      <Skeleton h="bar" w={100} gap="lg" />
      <Skeleton title />
      <Skeleton h="md" />
      <Skeleton h="md" mt />
    </div>
  );
}
