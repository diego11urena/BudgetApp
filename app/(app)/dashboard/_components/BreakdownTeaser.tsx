import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface BreakdownTeaserProps {
  t: Dictionary;
}

export default function BreakdownTeaser({ t }: BreakdownTeaserProps) {
  return (
    <Link href="/transactions/breakdown" className="breakdown-teaser">
      <div className="breakdown-teaser-content">
        <h3>See where it went</h3>
        <p>View spending trends and breakdown across categories</p>
      </div>
      <span className="breakdown-teaser-chevron">›</span>
    </Link>
  );
}
