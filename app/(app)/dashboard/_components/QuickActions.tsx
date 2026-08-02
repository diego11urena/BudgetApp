import Link from "next/link";

const ACTIONS = [
  { type: "EXPENSE", icon: "➖", label: "Add Expense" },
  { type: "INCOME", icon: "➕", label: "Add Income" },
  { type: "SAVINGS", icon: "🐷", label: "Add Savings" },
];

export function QuickActions() {
  return (
    <div className="quick-actions">
      {ACTIONS.map((action) => (
        <Link
          key={action.type}
          href={`/dashboard?type=${action.type}#log-transaction`}
          className="quick-action"
        >
          <span className="quick-action-icon">{action.icon}</span>
          <span>{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
