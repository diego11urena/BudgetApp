import Link from "next/link";
import { User } from "lucide-react";
import { hourInPanama } from "@/lib/pay-date";
import { EditPayInfoButton } from "./EditPayInfoButton";

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Header({
  name,
  currentPayAmount,
  currentPayDate,
  cycleId,
  previousBoundDate,
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
}) {
  const greeting = getGreeting(hourInPanama());
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="home-header">
      <div>
        {/* /dashboard is the PWA's start_url and main screen but has no
            visible page title (the greeting fills that role visually) --
            a real, if visually-hidden, <h1> is still required so it isn't
            the one route in the app with zero level-1 headings. */}
        <h1 className="sr-only">Dashboard</h1>
        <p className="home-greeting">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <div className="home-month">
          This Quincena&apos;s Budget
          <EditPayInfoButton
            currentAmount={currentPayAmount}
            currentPayDate={currentPayDate}
            cycleId={cycleId}
            previousBoundDate={previousBoundDate}
          />
        </div>
      </div>
      <Link href="/profile" className="home-profile-icon" aria-label="Profile">
        <User size={22} aria-hidden="true" />
      </Link>
    </div>
  );
}
