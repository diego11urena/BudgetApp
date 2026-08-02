import Link from "next/link";

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Header({ name }: { name?: string | null }) {
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const monthLabel = now.toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="home-header">
      <div>
        <p className="home-greeting">
          {greeting}
          {name ? `, ${name}` : ""}
        </p>
        <p className="home-month">{monthLabel} Budget</p>
      </div>
      <Link href="/profile" className="home-profile-icon" aria-label="Profile">
        👤
      </Link>
    </div>
  );
}
