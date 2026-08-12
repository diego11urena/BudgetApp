import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClosedCycles } from "@/lib/cycles";
import { summarizeCycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const closedCycles = await getClosedCycles(userId);

  return (
    <div className="home-page">
      <h1 className="page-title">History</h1>

      <div className="dashboard-section">
        {closedCycles.length === 0 ? (
          <p className="field-hint">
            No past quincenas yet — this fills in once you close your first one.
          </p>
        ) : (
          <div className="preview-box">
            {closedCycles.map((c) => {
              const cFinancials = summarizeCycleFinancials(c.incomeEntries, c.transactions);
              return (
                <Link href={`/history/${c.id}`} className="line-item line-item--link" key={c.id}>
                  <span>
                    {c.label} ({c.status})
                  </span>
                  <span>{formatCurrency(cFinancials.amountLeft)} left ›</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
