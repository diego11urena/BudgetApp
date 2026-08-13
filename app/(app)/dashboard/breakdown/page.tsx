import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { computeBreakdown, groupRecentTransactionsBySlice } from "@/lib/paycheck-breakdown";
import { BreakdownScreen } from "./_components/BreakdownScreen";

export default async function PaycheckBreakdownPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const financials = await getCycleFinancials(cycle.id);

  const breakdown = computeBreakdown(financials);
  const recentTransactionsBySlice = groupRecentTransactionsBySlice(
    financials.transactions,
    financials.categoryTotals,
  );

  return (
    <div className="home-page">
      <Link href="/dashboard" className="back-link">
        ← Back
      </Link>
      <h1 className="page-title">Paycheck Breakdown</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        100% of this quincena&apos;s income — where it went, and what&apos;s left.
      </p>

      <div className="dashboard-section">
        {breakdown.pieTotal <= 0 ? (
          <p className="field-hint">Nothing to show yet this quincena.</p>
        ) : (
          <BreakdownScreen breakdown={breakdown} recentTransactionsBySlice={recentTransactionsBySlice} />
        )}
      </div>
    </div>
  );
}
