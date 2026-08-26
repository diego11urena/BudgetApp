import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClosedCycles } from "@/lib/cycles";
import { summarizeCycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";

// CSS text-transform: capitalize can only *add* uppercase to a first
// letter, never lowercase the rest of an already-all-caps enum value like
// "CLOSED" -- doing it in JS is the only way to actually get "Closed".
function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export const metadata: Metadata = { title: "History" };

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
                    {formatFriendlyDate(c.periodStart)}{" "}
                    <span className="status-badge">{titleCase(c.status)}</span>
                  </span>
                  <span>
                    {formatCurrency(cFinancials.amountLeft)} left
                    <ChevronRight size={16} aria-hidden="true" className="inline-arrow" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
