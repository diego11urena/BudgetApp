import { Sparkles } from "lucide-react";

export function InsightsCard({ insights }: { insights: string[] }) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="insights-card">
      <p className="insights-title">
        <Sparkles size={16} aria-hidden="true" className="inline-arrow" /> Insights
      </p>
      <ul className="insights-list">
        {insights.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
