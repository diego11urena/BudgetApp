import Link from "next/link";
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
}: {
  name?: string | null;
  /** This cycle's already-recorded pay amount — prefills the "Edit" sheet. */
  currentPayAmount: number;
  /** "YYYY-MM-DD" — this cycle's periodStart, prefills the "Edit" sheet. */
  currentPayDate: string;
}) {
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="home-header">
      <div>
        <p className="home-greeting">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <div className="home-month">
          This Quincena&apos;s Budget
          <EditPayInfoButton currentAmount={currentPayAmount} currentPayDate={currentPayDate} />
        </div>
      </div>
      <Link href="/profile" className="home-profile-icon" aria-label="Profile">
        👤
      </Link>
    </div>
  );
}
