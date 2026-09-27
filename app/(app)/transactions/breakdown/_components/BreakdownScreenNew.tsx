"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useT, useVocab } from "@/app/_components/LocaleProvider";
import type { BiggestTransactionRow, CashFlowBreakdown } from "@/lib/breakdown-v2";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";
import type { CategoryRow, DayTransaction, HeatmapDayData } from "./types";
import CashFlowChapter from "./chapters/CashFlowChapter";
import RecurringChapter from "./chapters/RecurringChapter";
import ByCategoryChapter from "./chapters/ByCategoryChapter";
import WhenYouSpendChapter from "./chapters/WhenYouSpendChapter";
import BiggestTransactionsChapter from "./chapters/BiggestTransactionsChapter";

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
  heatmapDays: HeatmapDayData[];
  selectedDayDefault: string | null;
  transactionsByDay: Record<string, DayTransaction[]>;
  cashFlow: CashFlowBreakdown;
  recurringFulfillment: RecurringFulfillment;
  biggestTransactions: BiggestTransactionRow[];
  categories: CategoryRow[];
  /** Closed periods available for comparison, excluding the one being viewed. */
  historyCount: number;
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
  heatmapDays,
  selectedDayDefault,
  transactionsByDay,
  cashFlow,
  recurringFulfillment,
  biggestTransactions,
  categories,
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
        <section className="breakdown-chapter">
          <p className="breakdown-chapter-kicker">01</p>
          <h2 className="breakdown-chapter-title">{t.breakdown.chapter1Title}</h2>
          <p className="breakdown-chapter-takeaway">{t.breakdown.chapter1Takeaway(state)}</p>
          <CashFlowChapter cashFlow={cashFlow} incomeLine={t.breakdown.cashFlowIncomeLine(formatCurrency(cashFlow.income), dateRangeLabel)} />
        </section>

        <section className="breakdown-chapter">
          <p className="breakdown-chapter-kicker">02</p>
          <h2 className="breakdown-chapter-title">{t.breakdown.chapter2Title}</h2>
          <p className="breakdown-chapter-takeaway">{t.breakdown.chapter2Takeaway(vocab, state)}</p>
          <RecurringChapter fulfillment={recurringFulfillment} live={state === "LIVE"} />
        </section>

        <section className="breakdown-chapter">
          <p className="breakdown-chapter-kicker">03</p>
          <h2 className="breakdown-chapter-title">{t.breakdown.chapter3Title}</h2>
          <p className="breakdown-chapter-takeaway">{t.breakdown.chapter3Takeaway(vocab, dateRangeLabel, state)}</p>
          <ByCategoryChapter categories={categories} />
        </section>

        <section className="breakdown-chapter">
          <p className="breakdown-chapter-kicker">04</p>
          <h2 className="breakdown-chapter-title">{t.breakdown.chapter4Title}</h2>
          <WhenYouSpendChapter
            days={heatmapDays}
            defaultSelected={selectedDayDefault}
            transactionsByDay={transactionsByDay}
            state={state}
          />
        </section>

        <section className="breakdown-chapter">
          <p className="breakdown-chapter-kicker">05</p>
          <h2 className="breakdown-chapter-title">{t.breakdown.chapter5Title}</h2>
          <p className="breakdown-chapter-takeaway">{t.breakdown.chapter5Takeaway(state)}</p>
          <BiggestTransactionsChapter rows={biggestTransactions} />
        </section>
      </div>
    </div>
  );
}
