import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getAdjacentClosedCycles, getUserBudgetFrequency } from "@/lib/cycles";
import { prisma } from "@/lib/prisma";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import { getRequestLocale } from "@/lib/i18n/locale";
import { formatCycleLabel } from "@/lib/pay-date";
import { getGoalsWithProgress } from "@/lib/goals";
import SummaryScreen from "../_components/SummaryScreen";

export async function generateMetadata({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return { title: "Summary" };
}

export default async function SummaryPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const { cycleId } = await params;
  const userId = session.user.id;

  // Fetch the closed cycle.
  const cycle = await prisma.budgetCycle.findUnique({
    where: { id: cycleId },
  });

  if (!cycle || cycle.userId !== userId || cycle.status !== "CLOSED") {
    return notFound();
  }

  // Fetch financials and metadata.
  const budgetFrequency = await getUserBudgetFrequency(userId);
  const financials = await getCycleFinancials(cycleId);
  const { previous: prevCycle, next: nextCycle } = await getAdjacentClosedCycles(userId, cycle);

  // Fetch goals with progress for this cycle.
  const goalsWithProgress = await getGoalsWithProgress(userId, cycleId);

  // Dictionaries and vocab.
  const locale = await getRequestLocale();
  const t = getDictionary(locale);
  const vocab = resolveVocab(t, budgetFrequency);

  // Format cycle labels for display.
  const cycleLabel = formatCycleLabel(cycle.periodStart);
  const cycleRangeText = `${new Date(cycle.periodStart).toLocaleDateString()} – ${cycle.periodEnd?.toLocaleDateString() ?? ""}`.trim();

  return (
    <SummaryScreen
      cycle={cycle}
      cycleLabel={cycleLabel}
      cycleRangeText={cycleRangeText}
      budgetFrequency={budgetFrequency}
      financials={financials}
      goalsWithProgress={goalsWithProgress}
      prevCycle={prevCycle}
      nextCycle={nextCycle}
      vocab={vocab}
      t={t}
    />
  );
}
