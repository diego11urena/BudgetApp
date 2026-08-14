import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMostRecentClosedCycle, getOrCreateDraftCycle } from "@/lib/cycles";
import { getCycleFinancials, type CycleFinancials } from "@/lib/cycle-financials";
import {
  computePaymentMethodTotals,
  withUncategorizedBucket,
  type GroupTotal,
} from "@/lib/paycheck-breakdown";
import { BreakdownScreen, type BreakdownCycleData } from "./_components/BreakdownScreen";

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
    paymentMethodTotals: computePaymentMethodTotals(financials.transactions),
    transactions: financials.transactions,
  };
}

export default async function PaycheckBreakdownPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

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
      <Link href="/dashboard" className="back-link">
        <ChevronLeft size={16} aria-hidden="true" /> Back
      </Link>
      <h1 className="page-title">Paycheck Breakdown</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        Where this quincena&apos;s income went, and what&apos;s left.
      </p>

      <div className="dashboard-section">
        <BreakdownScreen currentCycle={currentCycle} lastCycle={lastCycle} />
      </div>
    </div>
  );
}
