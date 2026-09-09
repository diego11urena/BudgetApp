"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useT, useVocab } from "@/app/_components/LocaleProvider";

interface BreakdownScreenNewProps {
  state: "LIVE" | "CLOSED";
  dateRangeLabel: string;
  spent: number;
  projected: number;
  dayIndex: number;
  totalDays: number;
  comparisonAverage: number;
  /** How many OTHER closed cycles fed comparisonAverage -- 0 means there's no history to compare against yet, so the CLOSED banner falls back to a plain spent line. */
  comparisonCycleCount: number;
  prevCycleId: string | null;
  nextCycleId: string | null;
}

/**
 * Root of the Breakdown screen, both states. Everything it needs arrives as
 * plain strings/numbers -- the dictionary comes from LocaleProvider's
 * useT()/useVocab(), never as a prop, since its templated strings are
 * functions and React can't serialize those across the server/client
 * boundary (see LocaleProvider's own doc comment).
 */
export default function BreakdownScreenNew({
  state,
  dateRangeLabel,
  spent,
  projected,
  dayIndex,
  totalDays,
  comparisonAverage,
  comparisonCycleCount,
  prevCycleId,
  nextCycleId,
}: BreakdownScreenNewProps) {
  const router = useRouter();
  const t = useT();
  const vocab = useVocab();

  // The incoming half of the Summary -> Breakdown takeover. Cleaned up on
  // unmount (and once the animation has run) so these classes don't stay
  // stuck on <html> and re-fire on every later page this session renders.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("takeover-out");
    root.classList.add("takeover-wipe-in", "takeover-in");
    const done = () => root.classList.remove("takeover-wipe-in", "takeover-in");
    const timer = window.setTimeout(done, 600);
    return () => {
      window.clearTimeout(timer);
      done();
    };
  }, []);

  return (
    <div className="breakdown-screen-v2">
      <header className="breakdown-header">
        <button
          type="button"
          className="breakdown-header-back"
          onClick={() => router.back()}
          aria-label={t.common.back}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>

        <div className="breakdown-header-titles">
          {state === "CLOSED" && (
            <p className="breakdown-header-eyebrow">{t.breakdown.closedEyebrow(dateRangeLabel)}</p>
          )}
          <h1 className="breakdown-header-title">
            {state === "LIVE" ? t.breakdown.headingLive(vocab, vocab.thisPeriod) : t.breakdown.headingClosed}
          </h1>
          {state === "LIVE" && (
            <p className="breakdown-header-subline">{t.breakdown.sublineDay(dayIndex, totalDays)}</p>
          )}
        </div>

        <div className="breakdown-header-nav">
          {state === "CLOSED" && prevCycleId && (
            <button
              type="button"
              className="breakdown-header-chevron"
              onClick={() => router.push(`/transactions/breakdown?cycle=${prevCycleId}`)}
              aria-label={t.breakdown.prevCycleAria}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
          )}
          {state === "CLOSED" && nextCycleId && (
            <button
              type="button"
              className="breakdown-header-chevron"
              onClick={() => router.push(`/transactions/breakdown?cycle=${nextCycleId}`)}
              aria-label={t.breakdown.nextCycleAria}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <p className="breakdown-banner" role="status">
        {state === "LIVE"
          ? t.breakdown.bannerLive(vocab, dayIndex, totalDays, formatCurrency(spent), formatCurrency(projected))
          : comparisonCycleCount > 0
            ? t.breakdown.bannerClosed(formatCurrency(spent), formatCurrency(comparisonAverage))
            : formatCurrency(spent)}
      </p>

      <div className="breakdown-chapters">
        {[t.breakdown.chapter1Title, t.breakdown.chapter2Title, t.breakdown.chapter3Title, t.breakdown.chapter4Title].map(
          (title, i) => (
            <section className="breakdown-chapter" key={title}>
              <p className="breakdown-chapter-eyebrow">{String(i + 1).padStart(2, "0")}</p>
              <h2>{title}</h2>
              <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
