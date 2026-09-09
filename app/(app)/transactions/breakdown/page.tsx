import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAdjacentClosedCycles,
  getClosedCycles,
  getOrCreateDraftCycle,
  getUserBudgetFrequency,
} from "@/lib/cycles";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import { computeLiveBanner, computeSameDayIndexAverage } from "@/lib/breakdown-v2";
import { calendarDaysBetween, cycleEnd as resolveCycleEnd } from "@/lib/quincena-pace";
import { formatCycleRangeLabel } from "@/lib/format";
import BreakdownScreenNew from "./_components/BreakdownScreenNew";

export const metadata: Metadata = { title: "Breakdown" };

/**
 * Two states off one route, exactly as the design handoff specifies:
 * no `?cycle=` -> LIVE (the still-open draft cycle, with mid-cycle pacing),
 * `?cycle={id}` -> CLOSED (that historical cycle, with prev/next chevrons).
 *
 * Everything handed to BreakdownScreenNew below is a plain string/number --
 * never the Dictionary itself. Its templated strings are real functions
 * (`sublineDay: (day, total) => string`), and React can only serialize a
 * function across the server/client boundary when it's a "use server"
 * action, so passing `t` to a "use client" component throws at render time
 * and trips the error boundary. The client side reads the dictionary from
 * LocaleProvider's useT()/useVocab() instead -- see that file's own doc
 * comment, which spells out this exact rule.
 */
export default async function BreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const { cycle: cycleIdParam } = await searchParams;

  // Ownership and status are both enforced in the query itself -- a cycle
  // belonging to someone else, or one still open, is a 404 here rather
  // than a screen rendered against a cycle this user can't see.
  const cycle = cycleIdParam
    ? await prisma.budgetCycle.findFirst({ where: { id: cycleIdParam, userId, status: "CLOSED" } })
    : await getOrCreateDraftCycle(userId);
  if (!cycle) {
    notFound();
  }
  const state: "LIVE" | "CLOSED" = cycleIdParam ? "CLOSED" : "LIVE";

  const [budgetFrequency, financials] = await Promise.all([
    getUserBudgetFrequency(userId),
    getCycleFinancials(cycle.id),
  ]);

  // A closed cycle has a real periodEnd; an open one is still calendar-derived
  // (same fallback computeCyclePace itself uses).
  const periodEnd = cycle.periodEnd ?? resolveCycleEnd(cycle.periodStart, budgetFrequency);
  const totalDays = calendarDaysBetween(cycle.periodStart, periodEnd) + 1;
  // A closed cycle is always "day totalDays of totalDays"; a live one is
  // clamped into range so an overdue cycle (past its calendar end, not yet
  // closed) reads "day 15 of 15" rather than "day 19 of 15".
  const dayIndex =
    state === "LIVE"
      ? Math.min(Math.max(calendarDaysBetween(cycle.periodStart, new Date()) + 1, 1), totalDays)
      : totalDays;

  const banner = computeLiveBanner(financials.totalExpenses, dayIndex, totalDays);

  let prevCycleId: string | null = null;
  let nextCycleId: string | null = null;
  let comparisonAverage = 0;
  let comparisonCycleCount = 0;

  if (state === "CLOSED") {
    const [adjacent, closedCycles] = await Promise.all([
      getAdjacentClosedCycles(userId, cycle),
      getClosedCycles(userId, 5),
    ]);
    prevCycleId = adjacent.previous?.id ?? null;
    nextCycleId = adjacent.next?.id ?? null;

    // "Same point last cycle" only means anything against other cycles --
    // this one is excluded from its own trailing average.
    const others = closedCycles
      .filter((c) => c.id !== cycle.id)
      .map((c) => ({
        financials: summarizeCycleFinancials(c.incomeEntries, c.transactions),
        periodStart: c.periodStart,
      }));
    comparisonCycleCount = others.length;
    comparisonAverage = computeSameDayIndexAverage(others, totalDays);
  }

  return (
    <BreakdownScreenNew
      state={state}
      dateRangeLabel={formatCycleRangeLabel(cycle.periodStart, periodEnd)}
      spent={banner.spent}
      projected={banner.projected ?? 0}
      dayIndex={dayIndex}
      totalDays={totalDays}
      comparisonAverage={comparisonAverage}
      comparisonCycleCount={comparisonCycleCount}
      prevCycleId={prevCycleId}
      nextCycleId={nextCycleId}
    />
  );
}
