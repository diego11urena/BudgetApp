import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { emphasizeAmounts } from "@/lib/emphasize-amounts";
import type { Insight } from "@/lib/insights";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return null;
  }

  const t = getDictionary(await getRequestLocale()).dashboard;

  return (
    <div className="insights-card">
      <h2 className="insights-title">{t.insightsTitle}</h2>
      <ul className="insights-list">
        {insights.map((insight) => (
          <li key={insight.text} className="insights-row">
            <span className={`insights-dot insights-dot--${insight.severity ?? "neutral"}`} aria-hidden="true" />
            {insight.href ? (
              <Link href={insight.href} className="insights-list-link">
                <span>{emphasizeAmounts(insight.text)}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <span className="insights-text">{emphasizeAmounts(insight.text)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
