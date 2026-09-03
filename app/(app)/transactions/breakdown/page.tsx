import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMostRecentClosedCycle, getOrCreateDraftCycle, getUserPayFrequency } from "@/lib/cycles";
import { getCycleFinancials, type CycleFinancials } from "@/lib/cycle-financials";
import { withUncategorizedBucket, type GroupTotal } from "@/lib/paycheck-breakdown";
import { BreakdownScreen, type BreakdownCycleData } from "./_components/BreakdownScreen";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";

function toBreakdownCycleData(financials: CycleFinancials): BreakdownCycleData {
  const categoryTotals: GroupTotal[] = financials.categoryTotals.map((c) => ({
    id: c.categoryId,
    name: c.categoryName,
    amount: c.amount,
  }));

  return {
    baseIncome: financials.baseIncome,
    extraIncome: financials.extraIncome,
    totalExpenses: financials.totalExpenses,
    totalSavings: financials.totalSavings,
    categoryTotals: withUncategorizedBucket(categoryTotals, financials.totalExpenses),
    transactions: financials.transactions,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.transactions.breakdown.metaTitle };
}

export default async function PaycheckBreakdownPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());
  const vocab = resolveVocab(t, await getUserPayFrequency(userId));

  const cycle = await getOrCreateDraftCycle(userId);
  const lastClosedCycle = await getMostRecentClosedCycle(userId);

  const [financials, lastFinancials] = await Promise.all([
    getCycleFinancials(cycle.id),
    lastClosedCycle ? getCycleFinancials(lastClosedCycle.id) : Promise.resolve(null),
  ]);

  const currentCycle = toBreakdownCycleData(financials);
  const lastCycle = lastFinancials ? toBreakdownCycleData(lastFinancials) : null;

  return (
    <div className="home-page">
      <Link href="/transactions" className="back-link">
        <ChevronLeft size={16} aria-hidden="true" /> {t.transactions.breakdown.backToActivity}
      </Link>
      <h1 className="page-title">{t.transactions.breakdown.title}</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        {t.transactions.breakdown.subtitle(vocab)}
      </p>

      <div className="dashboard-section">
        <BreakdownScreen currentCycle={currentCycle} lastCycle={lastCycle} />
      </div>
    </div>
  );
}
