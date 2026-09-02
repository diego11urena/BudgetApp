import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClosedCycles } from "@/lib/cycles";
import { summarizeCycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.history.metaTitle };
}

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const closedCycles = await getClosedCycles(userId);

  return (
    <div className="home-page">
      <h1 className="page-title">{t.history.title}</h1>

      <div className="dashboard-section">
        {closedCycles.length === 0 ? (
          <p className="field-hint">{t.history.empty}</p>
        ) : (
          <div className="preview-box">
            {closedCycles.map((c) => {
              const cFinancials = summarizeCycleFinancials(c.incomeEntries, c.transactions);
              return (
                <Link href={`/history/${c.id}`} className="line-item line-item--link" key={c.id}>
                  <span>
                    {formatFriendlyDate(c.periodStart)}{" "}
                    <span className="status-badge">{t.history.closed}</span>
                  </span>
                  <span>
                    {t.history.left(formatCurrency(cFinancials.amountLeft))}
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
