import { hourInPanama } from "@/lib/pay-date";
import { EditPayInfoButton } from "./EditPayInfoButton";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { BudgetFrequency } from "@/lib/quincena-pace";

function getGreeting(hour: number, t: Dictionary["dashboard"]): string {
  if (hour < 12) return t.greetingMorning;
  if (hour < 18) return t.greetingAfternoon;
  return t.greetingEvening;
}

export async function Header({
  name,
  currentPayAmount,
  currentPayDate,
  cycleId,
  previousBoundDate,
  dateRangeLabel,
  budgetFrequency,
}: {
  name?: string | null;
  /** This cycle's already-recorded pay amount — prefills the "Edit" sheet. */
  currentPayAmount: number;
  /** "YYYY-MM-DD" — this cycle's periodStart, prefills the "Edit" sheet. */
  currentPayDate: string;
  /** The current draft cycle's id — lets "Edit" preview a pay-date change before committing, same as a closed cycle's own Edit trigger. */
  cycleId: string;
  /** "YYYY-MM-DD", exclusive — the earliest valid pay date (the previous cycle's own periodStart), or null if this is the account's first-ever cycle. */
  previousBoundDate: string | null;
  /** "Aug 16 – Aug 31" -- lib/format.ts's formatCycleRangeLabel, precomputed by the page since it needs both periodStart and periodEnd. */
  dateRangeLabel: string;
  budgetFrequency: BudgetFrequency;
}) {
  const dict = getDictionary(await getRequestLocale());
  const t = dict.dashboard;
  const vocab = resolveVocab(dict, budgetFrequency);
  const greeting = getGreeting(hourInPanama(), t);
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="home-header">
      <div>
        {/* /dashboard is the PWA's start_url and main screen but has no
            visible page title (the greeting fills that role visually) --
            a real, if visually-hidden, <h1> is still required so it isn't
            the one route in the app with zero level-1 headings. */}
        <h1 className="sr-only">{dict.nav.home}</h1>
        <p className="home-greeting">{firstName ? t.greeting(greeting, firstName) : greeting}</p>
        <p className="home-month">{t.dateRange(vocab, dateRangeLabel)}</p>
      </div>
      <EditPayInfoButton
        currentAmount={currentPayAmount}
        currentPayDate={currentPayDate}
        cycleId={cycleId}
        previousBoundDate={previousBoundDate}
        className="home-edit-pill"
      />
    </div>
  );
}
