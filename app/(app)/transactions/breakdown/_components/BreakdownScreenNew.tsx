"use client";

import { useRouter } from "next/navigation";
import type { BudgetCycle } from "@/app/generated/prisma/client";
import type { CycleFinancials } from "@/lib/cycle-financials";
import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";
import type { BudgetFrequency } from "@/lib/quincena-pace";

interface BreakdownScreenNewProps {
  cycle: BudgetCycle;
  state: "LIVE" | "CLOSED";
  budgetFrequency: BudgetFrequency;
  financials: CycleFinancials;
  prevCycle: BudgetCycle | null;
  nextCycle: BudgetCycle | null;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function BreakdownScreenNew({
  cycle,
  state,
  budgetFrequency,
  financials,
  prevCycle,
  nextCycle,
  vocab,
  t,
}: BreakdownScreenNewProps) {
  const router = useRouter();

  return (
    <div className="breakdown-screen-v2">
      {/* Header */}
      <div className="breakdown-header">
        <button
          className="breakdown-header-back"
          onClick={() => router.back()}
          aria-label={t.common.back}
        >
          ‹
        </button>

        {state === "CLOSED" && <div className="breakdown-header-eyebrow">{cycle.periodStart.toLocaleDateString()}</div>}

        <h1 className="breakdown-header-title">{state === "LIVE" ? "This period" : "Where it went"}</h1>

        {state === "CLOSED" && nextCycle && (
          <button
            className="breakdown-header-next"
            onClick={() => router.push(`/transactions/breakdown?cycle=${nextCycle.id}`)}
            aria-label={t.breakdown.nextCycleAria}
          >
            ›
          </button>
        )}
      </div>

      {/* Banner (state-dependent) */}
      <div className="breakdown-banner">
        {state === "LIVE" ? (
          <div>Day X of Y · ${financials.totalExpenses.toFixed(2)} spent · on pace for $XXX</div>
        ) : (
          <div>Same point last cycle: ${financials.totalExpenses.toFixed(2)} vs your $XXX average</div>
        )}
      </div>

      {/* Chapters */}
      <div className="breakdown-chapters">
        <section className="breakdown-chapter">
          <div className="breakdown-chapter-eyebrow">01</div>
          <h2>{t.breakdown.chapter1Title}</h2>
          <p>Heatmap (WIP)</p>
        </section>

        <section className="breakdown-chapter">
          <div className="breakdown-chapter-eyebrow">02</div>
          <h2>{t.breakdown.chapter2Title}</h2>
          <p>Trend (WIP)</p>
        </section>

        <section className="breakdown-chapter">
          <div className="breakdown-chapter-eyebrow">03</div>
          <h2>{t.breakdown.chapter3Title}</h2>
          <p>Fixed vs Flexible (WIP)</p>
        </section>

        <section className="breakdown-chapter">
          <div className="breakdown-chapter-eyebrow">04</div>
          <h2>{t.breakdown.chapter4Title}</h2>
          <p>By Category (WIP)</p>
        </section>
      </div>
    </div>
  );
}
