import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClosedCycles, getUserBudgetFrequency } from "@/lib/cycles";
import { summarizeCycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";

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
  const locale = await getRequestLocale();
  const t = getDictionary(locale);
  const vocab = resolveVocab(t, await getUserBudgetFrequency(userId));

  const closedCycles = await getClosedCycles(userId);

  return (
    <div className="home-page">
      <h1 className="page-title">{t.history.title}</h1>

      <div className={closedCycles.length === 0 ? "dashboard-section" : "dashboard-section profile-card history-list"}>
        {closedCycles.length === 0 ? (
          <p className="empty-state">{t.history.empty(vocab)}</p>
        ) : (
          /* Plain list, not .preview-box: that container is a dashed
             placeholder affordance, and these are real closed cycles. A
             dashed outline around actual content reads as an empty slot
             waiting to be filled. The surrounding .dashboard-section
             already provides the card. */
          <>
            {closedCycles.map((c) => {
              const cFinancials = summarizeCycleFinancials(c.incomeEntries, c.transactions);
              return (
                <Link href={`/history/${c.id}`} className="line-item line-item--link" key={c.id}>
                  <span>
                    {formatFriendlyDate(c.periodStart, locale)}{" "}
                    <span className="status-badge">{t.history.closed}</span>
                  </span>
                  <span className="profile-row-trailing">
                    <span className="history-row-amount">{t.history.left(formatCurrency(cFinancials.amountLeft))}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
