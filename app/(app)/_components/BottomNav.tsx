"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AddActionSheet } from "./AddActionSheet";
import { QuickAddSheet } from "./QuickAddSheet";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

interface Tab {
  href: string;
  label: string;
  icon: string;
}

// Rendered either side of the center "+" — Profile isn't a tab here since
// the avatar icon on Home already opens it.
const TABS_BEFORE_FAB: Tab[] = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/transactions", label: "Transactions", icon: "💳" },
];
const TABS_AFTER_FAB: Tab[] = [
  { href: "/budget", label: "Budget", icon: "📊" },
  { href: "/goals", label: "Goals", icon: "🎯" },
];

export function BottomNav({
  expenseCategoryNames,
  savingsCategoryNames,
  lastUsedIncomeName,
}: {
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  lastUsedIncomeName: string | null;
}) {
  const pathname = usePathname();
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<TxType | null>(null);
  // Same trigger-capture-on-click pattern QuickActions used — see its
  // comment for why this can't just be derived inside the sheet itself.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  function renderTab(tab: Tab) {
    const isActive = pathname.startsWith(tab.href);
    return (
      <Link
        key={tab.href}
        href={tab.href}
        className={`bottom-nav-item ${isActive ? "is-active" : ""}`}
      >
        <span className="bottom-nav-icon">{tab.icon}</span>
        <span className="bottom-nav-label">{tab.label}</span>
      </Link>
    );
  }

  return (
    <>
      <nav className="bottom-nav">
        {TABS_BEFORE_FAB.map(renderTab)}
        <button
          type="button"
          className="bottom-nav-fab"
          aria-label="Add a transaction"
          onClick={(e) => {
            setTriggerElement(e.currentTarget);
            setActionMenuOpen(true);
          }}
        >
          +
        </button>
        {TABS_AFTER_FAB.map(renderTab)}
      </nav>

      {actionMenuOpen && (
        <AddActionSheet
          returnFocusTo={triggerElement}
          onClose={() => setActionMenuOpen(false)}
          onSelect={(type) => {
            setActionMenuOpen(false);
            setQuickAddType(type);
          }}
        />
      )}

      {quickAddType && (
        <QuickAddSheet
          initialType={quickAddType}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          lastUsedIncomeName={lastUsedIncomeName}
          returnFocusTo={triggerElement}
          onClose={() => setQuickAddType(null)}
        />
      )}
    </>
  );
}
