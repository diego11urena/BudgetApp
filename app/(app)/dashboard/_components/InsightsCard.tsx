import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import type { Insight } from "@/lib/insights";

export function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="insights-card">
      <p className="insights-title">
        <Sparkles size={16} aria-hidden="true" className="inline-arrow" /> Insights
      </p>
      <ul className="insights-list">
        {insights.map((insight) => (
          <li key={insight.text} className="insights-row">
            <span className={`insights-dot insights-dot--${insight.severity ?? "neutral"}`} aria-hidden="true" />
            {insight.href ? (
              <Link href={insight.href} className="insights-list-link">
                <span>{insight.text}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <span className="insights-text">{insight.text}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
