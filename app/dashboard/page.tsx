import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRecentCycles } from "@/lib/cycles";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const cycles = await getRecentCycles(session.user.id);

  return (
    <div className="page-center">
      <div className="card card--wide">
        <h1>Welcome to BudgetApp</h1>
        <p className="field-hint">
          Onboarding is complete. The main dashboard isn&apos;t built yet — this is a stub
          confirming the redirect target and that your cycle data was saved.
        </p>
        <div className="preview-box">
          <strong>Cycles on file: {cycles.length}</strong>
          {cycles.map((cycle) => (
            <div className="line-item" key={cycle.id}>
              <span>
                {cycle.label} ({cycle.status})
              </span>
              <span>
                {cycle.incomeEntries.length} income · {cycle.budgetGoals.length} goals
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
