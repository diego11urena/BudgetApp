import Link from "next/link";

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Header({ name }: { name?: string | null }) {
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
        <p className="home-month">This Quincena&apos;s Budget</p>
      </div>
      <Link href="/profile" className="home-profile-icon" aria-label="Profile">
        👤
      </Link>
    </div>
  );
}
