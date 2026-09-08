import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle, getAdjacentClosedCycles, getUserBudgetFrequency } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import type { Metadata } from "next";
import BreakdownScreenNew from "./_components/BreakdownScreenNew";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: "Breakdown" };
}

interface PageProps {
  searchParams: Promise<{ cycle?: string }>;
}

export default async function BreakdownPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const userId = session.user.id;
  const params = await searchParams;
  const cycleIdParam = params.cycle;

  // Determine state (LIVE vs CLOSED) and fetch the appropriate cycle.
  let cycle: any;
  let state: "LIVE" | "CLOSED";

  if (cycleIdParam) {
    // CLOSED state: fetch the specified cycle.
    cycle = await prisma.budgetCycle.findUnique({
      where: { id: cycleIdParam },
    });

    if (!cycle || cycle.userId !== userId || cycle.status !== "CLOSED") {
      return notFound();
    }

    state = "CLOSED";
  } else {
    // LIVE state: fetch the open draft cycle.
    cycle = await getOrCreateDraftCycle(userId);
    state = "LIVE";
  }

  // Fetch metadata.
  const budgetFrequency = await getUserBudgetFrequency(userId);
  const financials = await getCycleFinancials(cycle.id);
  const locale = await getRequestLocale();
  const t = getDictionary(locale);
  const vocab = resolveVocab(t, budgetFrequency);

  // Fetch prev/next cycles for CLOSED navigation.
  let prevCycle = null;
  let nextCycle = null;
  if (state === "CLOSED") {
    const adjacent = await getAdjacentClosedCycles(userId, cycle);
    prevCycle = adjacent.previous;
    nextCycle = adjacent.next;
  }

  return (
    <BreakdownScreenNew
      cycle={cycle}
      state={state}
      budgetFrequency={budgetFrequency}
      financials={financials}
      prevCycle={prevCycle}
      nextCycle={nextCycle}
      vocab={vocab}
      t={t}
    />
  );
}
